import { parseHTML } from 'linkedom';
import type { Etymology, Example, NormalizedEntry, PartOfSpeech, Sense } from '../../schema/entry.js';
import { deterministicId } from '../../lib/id.js';
import { htmlToPlainText } from '../../http/sanitize.js';

const POS_TOKEN: Record<string, PartOfSpeech> = {
  'substantiv': 'substantiv',
  'subst.': 'substantiv',
  's.f.': 'substantiv',
  's.m.': 'substantiv',
  's.n.': 'substantiv',
  'verb': 'verb',
  'vb.': 'verb',
  'adjectiv': 'adjectiv',
  'adj.': 'adjectiv',
  'adverb': 'adverb',
  'adv.': 'adverb',
  'pronume': 'pronume',
  'pron.': 'pronume',
  'numeral': 'numeral',
  'num.': 'numeral',
  'prepoziție': 'prepoziție',
  'prep.': 'prepoziție',
  'conjuncție': 'conjuncție',
  'conj.': 'conjuncție',
  'interjecție': 'interjecție',
  'interj.': 'interjecție',
  'articol': 'articol',
  'art.': 'articol',
  'locuțiune': 'locuțiune',
  'loc.': 'locuțiune',
};

const REGISTER_TAGS = new Set([
  'fig.',
  'pop.',
  'fam.',
  'reg.',
  'rar',
  'înv.',
  'arh.',
  'lit.',
  'spec.',
  'tehn.',
  'jur.',
  'med.',
  'mar.',
  'mil.',
  'rel.',
  'ling.',
]);

export function parseDexonline(body: string, word: string): NormalizedEntry[] {
  if (!body) return [];
  const { document } = parseHTML(body);
  const entryNodes = collectEntryNodes(document);
  const out: NormalizedEntry[] = [];
  let idx = 0;
  for (const node of entryNodes) {
    const entry = buildEntry(node, word, idx++);
    if (entry) out.push(entry);
  }
  return out;
}

function collectEntryNodes(doc: Document): Element[] {
  const candidates = doc.querySelectorAll(
    'div.tree, section.entry, article.entry, div.def[id], div.entry',
  );
  const seen = new Set<Element>();
  const out: Element[] = [];
  for (const c of Array.from(candidates)) {
    if (seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  if (out.length === 0) {
    const wrappers = doc.querySelectorAll('.defWrapper, .meaning');
    for (const c of Array.from(wrappers)) out.push(c);
  }
  return out;
}

function buildEntry(node: Element, word: string, idx: number): NormalizedEntry | undefined {
  const text = htmlToPlainText(node.textContent ?? '');
  if (!text) return undefined;

  const display = pickHeadword(node) ?? word;
  const lower = display.toLocaleLowerCase('ro-RO');

  const headerText = (
    node.querySelector('.gramHead, .meaningTreeHeader, .grammar, .gram')?.textContent ?? ''
  ).trim();
  const grammarText = headerText || text;
  const { pos, gender } = inspectGrammar(grammarText);

  const senses = extractSenses(node, text);
  const etymology = extractEtymology(node, text);
  const examples = extractTopLevelExamples(node);
  const inflections: NormalizedEntry['inflections'] = [];

  const id = deterministicId(['dexonline', lower, idx]);
  const sourceCitation = pickSourceCitation(node);
  const fetchedAt = new Date().toISOString();

  if (senses.length === 0 && examples.length > 0) {
    senses.push({
      number: 1,
      text: examples[0]?.text ?? '',
      register: [],
      examples,
      synonyms: [],
      antonyms: [],
    });
  }

  return {
    id,
    headword: lower,
    displayHeadword: display,
    partOfSpeech: pos,
    ...(gender ? { gender } : {}),
    inflections,
    pronunciations: [],
    senses,
    ...(etymology ? { etymology } : {}),
    source: {
      providerId: 'dexonline',
      providerName: 'DEXonline',
      ...(sourceCitation ? { workTitle: sourceCitation } : {}),
      url: `https://dexonline.ro/definitie/${encodeURIComponent(word)}`,
      license: 'GPL-2.0-or-later',
      attribution: 'DEXonline.ro (CC GPL); see source citation per definition.',
      fetchedAt,
      cacheHit: false,
    },
  };
}

function pickHeadword(node: Element): string | undefined {
  const candidates = node.querySelectorAll('.headword, .lemma, .entry-header h3, h3, .form');
  for (const c of Array.from(candidates)) {
    const t = (c.textContent ?? '').trim();
    if (t) return t.split(/\s/)[0];
  }
  return undefined;
}

function inspectGrammar(headerText: string): {
  pos: PartOfSpeech;
  gender?: NormalizedEntry['gender'];
} {
  const lower = headerText.toLocaleLowerCase('ro-RO');
  let pos: PartOfSpeech = 'unknown';
  let gender: NormalizedEntry['gender'] | undefined;
  if (/\bs\.\s*[fmn]\.|substantiv/.test(lower)) pos = 'substantiv';
  else if (/\bvb\.|\bverb\b/.test(lower)) pos = 'verb';
  else if (/\badj\.|\badjectiv\b/.test(lower)) pos = 'adjectiv';
  else if (/\badv\.|\badverb\b/.test(lower)) pos = 'adverb';
  else if (/\bpron\.|\bpronume\b/.test(lower)) pos = 'pronume';
  else if (/\bnum\.|\bnumeral\b/.test(lower)) pos = 'numeral';
  else if (/\bprep\.|\bprepoziție\b/.test(lower)) pos = 'prepoziție';
  else if (/\bconj\.|\bconjuncție\b/.test(lower)) pos = 'conjuncție';
  else if (/\binterj\.|\binterjecție\b/.test(lower)) pos = 'interjecție';
  else {
    for (const [token, mapped] of Object.entries(POS_TOKEN)) {
      if (lower.includes(token)) {
        pos = mapped;
        break;
      }
    }
  }
  if (/\bs\.\s*f\.|substantiv feminin|\bfeminin\b/.test(lower)) gender = 'feminin';
  else if (/\bs\.\s*m\.|substantiv masculin|\bmasculin\b/.test(lower)) gender = 'masculin';
  else if (/\bs\.\s*n\.|substantiv neutru|\bneutru\b/.test(lower)) gender = 'neutru';
  return gender ? { pos, gender } : { pos };
}

function extractSenses(node: Element, fallbackText: string): Sense[] {
  const senseNodes = node.querySelectorAll('li.meaning, .meaning, .def, .defContent');
  const senses: Sense[] = [];
  let counter = 1;
  for (const n of Array.from(senseNodes)) {
    const text = htmlToPlainText(n.textContent ?? '');
    if (!text) continue;
    const cleaned = stripLeadingNumber(text);
    if (!cleaned) continue;
    const examples: Example[] = [];
    for (const ex of Array.from(n.querySelectorAll('.example, em, blockquote'))) {
      const exText = htmlToPlainText(ex.textContent ?? '');
      if (exText && exText !== cleaned) examples.push({ text: exText });
    }
    const register = extractRegisterTags(cleaned);
    senses.push({
      number: counter++,
      text: cleaned,
      register,
      examples,
      synonyms: [],
      antonyms: [],
    });
  }
  if (senses.length > 0) return senses;
  return splitNumberedFallback(fallbackText);
}

function splitNumberedFallback(text: string): Sense[] {
  const out: Sense[] = [];
  const re = /(?:^|[\s.])(\d+)\.\s+/g;
  const parts: { num: number; start: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    parts.push({ num: Number(m[1]), start: m.index + (m[0].startsWith(' ') ? 1 : 0) });
  }
  if (parts.length === 0) return out;
  for (let i = 0; i < parts.length; i++) {
    const cur = parts[i];
    const nxt = parts[i + 1];
    if (!cur) continue;
    const slice = text.slice(cur.start, nxt?.start ?? text.length);
    const cleaned = stripLeadingNumber(slice).trim();
    if (cleaned) {
      out.push({
        number: cur.num,
        text: cleaned,
        register: extractRegisterTags(cleaned),
        examples: [],
        synonyms: [],
        antonyms: [],
      });
    }
  }
  return out;
}

function stripLeadingNumber(s: string): string {
  return s.replace(/^\s*\d+\.\s*/, '').trim();
}

function extractRegisterTags(text: string): string[] {
  const out: string[] = [];
  for (const tag of REGISTER_TAGS) {
    if (text.toLocaleLowerCase('ro-RO').includes(tag)) out.push(tag);
  }
  return out;
}

function extractEtymology(node: Element, fallbackText: string): Etymology | undefined {
  const elem = node.querySelector('.etymology, .etim');
  if (elem) {
    const text = htmlToPlainText(elem.textContent ?? '');
    if (text) return { text, languages: pickLanguageCodes(text) };
  }
  const m = fallbackText.match(/(?:Etim\.?|Etymol\.?|Din)\s*[:\-]?\s*([^.]+)/);
  if (m?.[1]) {
    const text = m[1].trim();
    if (text.length > 0 && text.length < 256) {
      return { text, languages: pickLanguageCodes(text) };
    }
  }
  return undefined;
}

function pickLanguageCodes(text: string): string[] {
  const out = new Set<string>();
  const codes = ['lat.', 'fr.', 'germ.', 'engl.', 'gr.', 'sl.', 'tc.', 'mag.', 'rus.', 'it.'];
  const lower = text.toLocaleLowerCase('ro-RO');
  for (const c of codes) if (lower.includes(c)) out.add(c);
  return Array.from(out);
}

function extractTopLevelExamples(node: Element): Example[] {
  const out: Example[] = [];
  for (const ex of Array.from(node.querySelectorAll(':scope > .example, :scope > em'))) {
    const t = htmlToPlainText(ex.textContent ?? '');
    if (t) out.push({ text: t });
  }
  return out;
}

function pickSourceCitation(node: Element): string | undefined {
  const r = node.querySelector('.source, .sourceName, .ref');
  if (!r) return undefined;
  const t = htmlToPlainText(r.textContent ?? '');
  return t || undefined;
}
