/**
 * DOOM 3 parser.
 *
 * The live page (https://doom.lingv.ro/cautare/q/<word>) is a Bootstrap HTML
 * document with TEI XML embedded inline -- one `<root><entry>` block per
 * result. Everything useful is in the markup rather than the prose:
 *
 *   <span style="font-weight: bold">c<span style="text-decoration:underline">a</span>să</span>
 *   s. f., g.-d. art. <span style="font-style: italic;">c<u>a</u>sei</span>;
 *   pl. <span style="font-style: italic;">c<u>a</u>se</span>
 *   (dar:<span style="font-style:italic"> Casa Corpului Didactic, ...</span> s. proprii f. art.)
 *
 * - the first bold span is the lemma, with `<sup>` carrying the homonym index
 * - every inflected form is its own italic span
 * - the stressed vowel is wrapped in a `text-decoration:underline` span
 * - syllabification, where DOOM gives it at all, is in
 *   `<span class="doom-tooltip" title="despărțirea in silabe">`
 *
 * The previous implementation fed the whole HTML page to fast-xml-parser and
 * walked the resulting object, which interleaved attribute values with text and
 * produced headwords like "s." and inflections like "art.". It also split
 * clauses on "," without regard for parentheses, so the aside
 * "(dar: Casa Corpului Didactic, ...)" became five plural forms of "casă".
 *
 * Reading the DOM directly avoids both, and recovers the stress and
 * syllabification the old text-flattening threw away.
 */
import { parseHTML } from 'linkedom';
import { isAbbreviationToken, readGrammar } from '../../extract/abbrev.js';
import { stripBracketed } from '../../extract/segment.js';
import { deterministicId } from '../../lib/id.js';
import type { Inflection, NormalizedEntry, Pronunciation } from '../../schema/entry.js';

/** Grammatical labels that introduce an inflected form, longest first. */
const FORM_LABELS: Array<[RegExp, string[]]> = [
  // Verb paradigm
  [/ind\.?\s*prez\.?\s*(\d)\s*(sg|pl)\b/i, ['indicative', 'present']],
  [/ind\.?\s*imperf\.?\s*(\d)\s*(sg|pl)\b/i, ['indicative', 'imperfect']],
  [/perf\.?\s*s\.?\s*(\d)\s*(sg|pl)\b/i, ['indicative', 'simple-perfect']],
  [/m\.m\.c\.p\.?\s*(\d)\s*(sg|pl)\b/i, ['indicative', 'pluperfect']],
  [/conj\.?\s*prez\.?\s*(\d)?\s*(sg|pl)?\b/i, ['subjunctive', 'present']],
  [/imper\.?\s*(\d)?\s*(sg|pl)?\b/i, ['imperative']],
  [/ger\.?\b/i, ['gerund']],
  [/part\.?\b/i, ['participle']],
  [/inf\.?\s*lg\.?\b/i, ['infinitive', 'long']],
  // Nominal paradigm
  [/g\.?\s*-?\s*d\.?\s*art\.?\b/i, ['genitive', 'dative', 'articulated']],
  [/g\.?\s*-?\s*d\.?\b/i, ['genitive', 'dative']],
  [/voc\.?\b/i, ['vocative']],
  [/pl\.?\s*art\.?\b/i, ['plural', 'articulated']],
  [/pl\.?\b/i, ['plural']],
  [/art\.?\b/i, ['articulated']],
];

interface FormNode {
  text: string;
  stressIndex: number;
  /** Offset of this form within the entry's plain text. */
  start: number;
  end: number;
}

interface EntryParts {
  lemma: string;
  lemmaStressIndex: number;
  homonymIndex?: number;
  plainText: string;
  forms: FormNode[];
  syllabification?: string;
}

export function parseDoom(body: string, word: string): NormalizedEntry[] {
  if (!body.trim()) return [];

  const fragments = extractEntryFragments(body);
  if (fragments.length === 0) return [];

  const target = normalize(word);
  const parsed = fragments.map(parseEntryFragment).filter((p): p is EntryParts => p !== undefined);

  // Exact lemma match only. `startsWith` used to make a query for "casă"
  // return "casă-muzeu" as though it were the same word.
  const matched = parsed.filter((p) => normalize(p.lemma) === target);
  if (matched.length === 0) return [];

  return matched.map((p, idx) => buildEntry(p, word, idx));
}

/** Pull each `<entry>…</entry>` block out of the surrounding HTML page. */
function extractEntryFragments(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)) {
    const inner = m[1];
    if (inner?.trim()) out.push(inner);
  }
  return out;
}

function normalize(s: string): string {
  return s.normalize('NFC').trim().toLocaleLowerCase('ro-RO');
}

function isItalic(el: Element): boolean {
  const style = el.getAttribute('style') ?? '';
  return /font-style\s*:\s*italic/i.test(style);
}

function isBold(el: Element): boolean {
  const style = el.getAttribute('style') ?? '';
  return /font-weight\s*:\s*bold/i.test(style);
}

function isUnderline(el: Element): boolean {
  const style = el.getAttribute('style') ?? '';
  return /text-decoration\s*:\s*underline/i.test(style);
}

/**
 * Text content of a node, plus the offset of the stressed vowel if one of its
 * descendants is an underline span. Returns -1 when there is no stress mark.
 */
function textWithStress(node: Node): { text: string; stressIndex: number } {
  let text = '';
  let stressIndex = -1;

  const walk = (n: Node): void => {
    for (const child of Array.from(n.childNodes)) {
      if (child.nodeType === 3) {
        text += child.textContent ?? '';
        continue;
      }
      if (child.nodeType !== 1) continue;
      const el = child as Element;
      if (isUnderline(el) && stressIndex === -1) {
        stressIndex = text.length;
      }
      walk(el);
    }
  };
  walk(node);
  return { text, stressIndex };
}

function parseEntryFragment(fragment: string): EntryParts | undefined {
  const { document } = parseHTML(`<div id="doom-entry">${fragment}</div>`);
  const root = document.getElementById('doom-entry');
  if (!root) return undefined;

  const spans = Array.from(root.querySelectorAll('span'));

  // The lemma is the first bold span. A second bold span may follow carrying
  // the verb marker " (a ~)", which is not part of the lemma.
  const lemmaSpan = spans.find(isBold);
  if (!lemmaSpan) return undefined;

  const sup = lemmaSpan.querySelector('sup');
  const homonymRaw = sup?.textContent?.trim();
  sup?.remove();

  const { text: lemmaText, stressIndex: lemmaStress } = textWithStress(lemmaSpan);
  const lemma = lemmaText.replace(/\s+/g, ' ').trim();
  if (!lemma || isAbbreviationToken(lemma)) return undefined;

  const syllabification = Array.from(root.querySelectorAll('span.doom-tooltip'))
    .map((s) => s.textContent?.trim() ?? '')
    .find((t) => t.includes('-'));

  // Build the entry's plain text while recording where each italic form sits,
  // so bracket depth can be evaluated on the text and applied to the forms.
  const forms: FormNode[] = [];
  let plainText = '';

  const collect = (n: Node): void => {
    for (const child of Array.from(n.childNodes)) {
      if (child.nodeType === 3) {
        plainText += child.textContent ?? '';
        continue;
      }
      if (child.nodeType !== 1) continue;
      const el = child as Element;
      if (el === lemmaSpan) {
        plainText += lemmaText;
        continue;
      }
      if (isItalic(el) && !isBold(el)) {
        const { text, stressIndex } = textWithStress(el);
        const start = plainText.length;
        plainText += text;
        forms.push({ text, stressIndex, start, end: plainText.length });
        continue;
      }
      collect(el);
    }
  };
  collect(root);

  const parts: EntryParts = {
    lemma,
    lemmaStressIndex: lemmaStress,
    plainText: plainText.replace(/ /g, ' '),
    forms,
  };
  if (homonymRaw && /^\d+$/.test(homonymRaw)) parts.homonymIndex = Number(homonymRaw);
  if (syllabification) parts.syllabification = syllabification;
  return parts;
}

/** Bracket nesting depth at each character offset of `text`. */
function depthMap(text: string): number[] {
  const depths: number[] = new Array(text.length);
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(' || ch === '[') {
      depth++;
      depths[i] = depth;
      continue;
    }
    depths[i] = depth;
    if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
  }
  return depths;
}

function buildEntry(parts: EntryParts, word: string, idx: number): NormalizedEntry {
  const grammar = readGrammar(stripBracketed(parts.plainText));
  const inflections = extractInflections(parts);

  const pronunciations: Pronunciation[] = [];
  const stressMark = applyAcute(parts.lemma, parts.lemmaStressIndex);
  if (stressMark || parts.syllabification) {
    const p: Pronunciation = {};
    if (stressMark) p.stressMark = stressMark;
    if (parts.syllabification) p.syllabification = parts.syllabification;
    pronunciations.push(p);
  }

  const lower = normalize(parts.lemma);
  const entry: NormalizedEntry = {
    id: deterministicId(['doom', lower, parts.homonymIndex ?? idx]),
    headword: lower,
    displayHeadword: parts.lemma,
    partOfSpeech: grammar.partOfSpeech,
    inflections,
    pronunciations,
    // DOOM is an orthographic dictionary: it carries no definitions.
    senses: [],
    source: {
      providerId: 'doom',
      providerName: 'DOOM 3',
      workTitle: 'Dicționarul ortografic, ortoepic și morfologic al limbii române',
      url: `https://doom.lingv.ro/cautare/q/${encodeURIComponent(word)}`,
      license: 'CC-BY-NC-SA-4.0',
      attribution: 'Institutul de Lingvistică „Iorgu Iordan – Al. Rosetti", DOOM 3',
      fetchedAt: new Date().toISOString(),
      cacheHit: false,
    },
  };
  if (grammar.gender) entry.gender = grammar.gender;
  return entry;
}

function extractInflections(parts: EntryParts): Inflection[] {
  const depths = depthMap(parts.plainText);
  const out: Inflection[] = [];
  const seen = new Set<string>();

  let labelStart = 0;
  // DOOM elides a repeated tense: "perf. s. 1 sg. mersei, 1 pl. merserăm" gives
  // the second form the bare label "1 pl.". Carry the mood/tense forward.
  let carriedTense: string[] = [];

  for (const form of parts.forms) {
    // A form inside "(...)" is an editorial aside, not a paradigm cell: this is
    // what kept "Casa Corpului Didactic" out of casă's plural forms. Such a
    // form is left inside the label text (stripBracketed removes it later)
    // rather than advancing labelStart, so it cannot swallow the real label of
    // the form that follows it.
    if ((depths[form.start] ?? 0) > 0) continue;

    const labelText = parts.plainText.slice(labelStart, form.start);
    labelStart = form.end;

    // The label is whatever follows the last clause separator.
    const lastSep = Math.max(labelText.lastIndexOf(','), labelText.lastIndexOf(';'));
    const label = stripBracketed(lastSep === -1 ? labelText : labelText.slice(lastSep + 1));

    const { tags, carriesTense } = tagsFromLabel(label, carriedTense);
    if (carriesTense.length > 0) carriedTense = carriesTense;
    if (tags.length === 0) continue;

    for (const cleaned of cleanForms(form.text)) {
      const key = `${cleaned}|${tags.join(',')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ form: cleaned, tags });
    }
  }
  return out;
}

/** A label that is only a person/number marker, e.g. "1 pl.", "3 sg.", "3". */
const BARE_PERSON_NUMBER = /^(\d)\s*(sg|pl)?\.?$/i;

interface LabelReading {
  tags: string[];
  /** Mood/tense tags to carry into a later elided label. */
  carriesTense: string[];
}

function tagsFromLabel(label: string, carriedTense: readonly string[]): LabelReading {
  const trimmed = label.trim();
  if (!trimmed) return { tags: [], carriesTense: [] };

  const bare = trimmed.match(BARE_PERSON_NUMBER);
  if (bare) {
    if (carriedTense.length === 0) return { tags: [], carriesTense: [] };
    const out = [...carriedTense];
    if (bare[1]) out.push(`person:${bare[1]}`);
    if (bare[2]) out.push(bare[2].toLowerCase() === 'pl' ? 'plural' : 'singular');
    return { tags: out, carriesTense: [] };
  }

  for (const [re, tags] of FORM_LABELS) {
    const m = trimmed.match(re);
    if (!m) continue;
    const person = m[1];
    const number = m[2];
    const out = [...tags];
    if (person) out.push(`person:${person}`);
    if (number) out.push(number.toLowerCase() === 'pl' ? 'plural' : 'singular');
    // Only verb paradigm labels are elided in later clauses.
    const carries = tags.some((t) => ['indicative', 'subjunctive', 'imperative'].includes(t))
      ? tags
      : [];
    return { tags: out, carriesTense: carries };
  }
  return { tags: [], carriesTense: [] };
}

/**
 * Normalise a form span's text into the word form(s) it denotes.
 *
 * Drops the subjunctive particle ("să meargă" -> "meargă"), strips editorial
 * brackets, and refuses abbreviation fragments.
 */
function cleanForms(raw: string): string[] {
  const text = stripBracketed(raw).replace(/ /g, ' ').trim();
  if (!text) return [];

  const withoutParticle = text.replace(/^(să|a)\s+/i, '').trim();
  const candidate = withoutParticle.replace(/[.,;:]+$/, '').trim();
  if (!candidate || isAbbreviationToken(candidate)) return [];

  // A form span holding a comma-separated list is a list of variants.
  if (candidate.includes(',')) {
    return candidate
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s && !isAbbreviationToken(s));
  }
  return [candidate];
}

/**
 * Render the stressed vowel with an acute accent, the convention Romanian
 * dictionaries use: "casă" stressed on the first "a" becomes "cásă".
 */
function applyAcute(lemma: string, stressIndex: number): string | undefined {
  if (stressIndex < 0 || stressIndex >= lemma.length) return undefined;
  const before = lemma.slice(0, stressIndex);
  const vowel = lemma[stressIndex];
  const after = lemma.slice(stressIndex + 1);
  if (!vowel) return undefined;
  return `${before}${vowel}́${after}`.normalize('NFC');
}
