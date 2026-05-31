/**
 * ro.wiktionary parser.
 *
 * The previous implementation searched for markup ro.wiktionary does not use --
 * `{{ro-substantiv}}`, `==Substantiv==`, `{{IPA|…}}` and a rendered
 * "Etimologie" heading -- so against the real page every structured field came
 * back empty (pos `unknown`, no gender, no IPA, no etymology, no inflections)
 * while `senses` was filled with 66 entries, most of them derived terms and
 * compounds harvested from unrelated sections.
 *
 * The real markup is Romanian-named:
 *
 *   {{-etimologie-}} / {{-pronunție-}} / {{-substantiv-|ron}} / {{-sin-}} /
 *   {{-deriv-}} / {{-comp-}} / {{-hiper-}} / {{-expr-}}
 *   {{substantiv-ron |gen={{f}} |nom-sg=casă |nom-pl=case |art-sg=casa …}}
 *   {{AFI|/'ka.sə/}}
 *
 * Senses are the `#` lines inside the part-of-speech section, and only those;
 * `#:` lines beneath them are examples.
 */
import { readGrammar } from '../../extract/abbrev.js';
import {
  languageSection,
  renderWikitext,
  splitSections,
  templateParams,
} from '../../extract/wikitext.js';
import { deterministicId } from '../../lib/id.js';
import type {
  Etymology,
  Gender,
  Inflection,
  NormalizedEntry,
  PartOfSpeech,
  Pronunciation,
  Sense,
} from '../../schema/entry.js';

/** `{{-substantiv-|ron}}` and friends -> our POS enum. */
const POS_SECTIONS: Record<string, PartOfSpeech> = {
  '-substantiv-': 'substantiv',
  '-verb-': 'verb',
  '-adjectiv-': 'adjectiv',
  '-adverb-': 'adverb',
  '-pronume-': 'pronume',
  '-numeral-': 'numeral',
  '-prepoziție-': 'prepoziție',
  '-conjuncție-': 'conjuncție',
  '-interjecție-': 'interjecție',
  '-articol-': 'articol',
  '-expresie-': 'expresie',
  '-locuțiune-': 'locuțiune',
};

const GENDER_TEMPLATES: Record<string, Gender> = {
  f: 'feminin',
  m: 'masculin',
  n: 'neutru',
};

/** Declension/conjugation parameter names -> inflection tags. */
const PARAM_TAGS: Record<string, string[]> = {
  // {{substantiv-ron}} / {{adjectiv-ron}}
  'nom-sg': ['nominative', 'singular'],
  'nom-pl': ['nominative', 'plural'],
  'art-sg': ['articulated', 'singular'],
  'art-pl': ['articulated', 'plural'],
  'dat-sg': ['dative', 'genitive', 'singular'],
  'dat-pl': ['dative', 'genitive', 'plural'],
  'voc-sg': ['vocative', 'singular'],
  'voc-pl': ['vocative', 'plural'],
  // {{verb-ron|inf=…|ind=…|conj=…|part=…|cj=III}}
  inf: ['infinitive'],
  ind: ['indicative', 'present'],
  conj: ['subjunctive', 'present'],
  part: ['participle'],
  ger: ['gerund'],
};

interface ApiResponse {
  parse?: { title?: string; wikitext?: string };
  error?: { code: string; info: string };
}

export function parseWiktionary(body: string, word: string): NormalizedEntry[] {
  let parsed: ApiResponse;
  try {
    parsed = JSON.parse(body) as ApiResponse;
  } catch {
    return [];
  }
  if (parsed.error || !parsed.parse?.wikitext) return [];

  // Only the Romanian part of the page: ro.wiktionary documents every language
  // that shares a spelling on one page, and `ou` has ron/cat/eng/fra sections.
  const wikitext = languageSection(parsed.parse.wikitext, 'ron');
  if (!wikitext.trim()) return [];
  const display = parsed.parse.title || word;
  const sections = splitSections(wikitext);

  const posSection = sections.find((s) => POS_SECTIONS[s.name.toLowerCase()]);
  const partOfSpeech = posSection
    ? (POS_SECTIONS[posSection.name.toLowerCase()] ?? 'unknown')
    : 'unknown';

  const senses = posSection ? extractSenses(posSection.lines) : [];
  const synonyms = collectListItems(sections, '-sin-');
  const antonyms = collectListItems(sections, '-ant-');
  if (synonyms.length > 0 && senses[0]) senses[0].synonyms = synonyms;
  if (antonyms.length > 0 && senses[0]) senses[0].antonyms = antonyms;

  const pronunciations = extractPronunciations(wikitext);
  const etymology = extractEtymology(sections);
  const { inflections, gender, classRoman } = extractParadigm(wikitext, partOfSpeech);

  if (
    senses.length === 0 &&
    pronunciations.length === 0 &&
    !etymology &&
    inflections.length === 0
  ) {
    return [];
  }

  const lower = display.normalize('NFC').toLocaleLowerCase('ro-RO');
  const entry: NormalizedEntry = {
    id: deterministicId(['wiktionary', lower, 0]),
    headword: lower,
    displayHeadword: display,
    partOfSpeech,
    inflections,
    pronunciations,
    senses,
    source: {
      providerId: 'wiktionary',
      providerName: 'Wikționar (Wiktionary RO)',
      url: `https://ro.wiktionary.org/wiki/${encodeURIComponent(display)}`,
      license: 'CC-BY-SA-4.0',
      attribution: 'Wikționar contributors, ro.wiktionary.org',
      fetchedAt: new Date().toISOString(),
      cacheHit: false,
    },
  };
  if (gender) entry.gender = gender;
  if (etymology) entry.etymology = etymology;
  if (classRoman) entry.conjugation = { classRoman, forms: {} };
  return [entry];
}

/**
 * Senses are `#` lines; `#:` (and `#*`) lines are examples belonging to the
 * preceding sense. Anything else in the section is ignored.
 */
function extractSenses(lines: readonly string[]): Sense[] {
  const senses: Sense[] = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.startsWith('#')) continue;

    if (/^#[:*]/.test(line)) {
      const text = renderWikitext(line.replace(/^#[:*]+\s*/, ''));
      const last = senses[senses.length - 1];
      if (text && last) last.examples.push({ text });
      continue;
    }

    const text = renderWikitext(line.replace(/^#+\s*/, ''));
    if (!text) continue;
    senses.push({
      number: senses.length + 1,
      text,
      register: readGrammar(text).register,
      examples: [],
      synonyms: [],
      antonyms: [],
    });
  }
  return senses;
}

/** Bullet items of a `{{-name-}}` section, rendered to plain text. */
function collectListItems(sections: ReturnType<typeof splitSections>, name: string): string[] {
  const section = sections.find((s) => s.name.toLowerCase() === name);
  if (!section) return [];
  const out: string[] = [];
  for (const line of section.lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const body = trimmed.startsWith('*') ? trimmed.replace(/^\*+\s*/, '') : trimmed;
    // {{-sin-}} often lists everything on one comma-separated line.
    for (const part of renderWikitext(body).split(',')) {
      const t = part.trim();
      if (t) out.push(t);
    }
  }
  return out;
}

function extractPronunciations(wikitext: string): Pronunciation[] {
  const seen = new Set<string>();
  const out: Pronunciation[] = [];
  // {{AFI|…}} -- Alfabetul Fonetic Internațional. The bare {{AFI}} label form
  // carries no value and is skipped by requiring a pipe.
  for (const m of wikitext.matchAll(/\{\{\s*AFI\s*\|\s*([^}|]+?)\s*\}\}/gi)) {
    const value = m[1]?.trim();
    if (!value) continue;
    const ipa = normalizeIpa(value);
    if (seen.has(ipa)) continue;
    seen.add(ipa);
    out.push({ ipa });
  }
  return out;
}

/**
 * Editors type an ASCII apostrophe for the stress mark; IPA uses U+02C8.
 * Likewise U+02CC for secondary stress.
 */
function normalizeIpa(value: string): string {
  return value.replace(/'/g, 'ˈ').replace(/,(?=[a-zɐ-ʯ])/g, 'ˌ');
}

const ETY_LANGUAGES = [
  'latină',
  'franceză',
  'germană',
  'engleză',
  'greacă',
  'slavă',
  'turcă',
  'maghiară',
  'rusă',
  'italiană',
  'bulgară',
  'sârbă',
  'ucraineană',
];

function extractEtymology(sections: ReturnType<typeof splitSections>): Etymology | undefined {
  const section = sections.find((s) => s.name.toLowerCase() === '-etimologie-');
  if (!section) return undefined;
  const text = section.lines
    .map((l) => renderWikitext(l))
    .filter(Boolean)
    .join(' ')
    .trim();
  if (!text) return undefined;

  const lower = text.toLocaleLowerCase('ro-RO');
  const languages = ETY_LANGUAGES.filter((l) => lower.includes(l));
  return { text, languages };
}

/**
 * Read the declension/conjugation template, e.g. `{{substantiv-ron|…}}`.
 * Returns the gender it declares alongside the forms.
 */
function extractParadigm(
  wikitext: string,
  partOfSpeech: PartOfSpeech,
): { inflections: Inflection[]; gender?: Gender; classRoman?: string } {
  const templateName = `${partOfSpeech}-ron`;
  const params = templateParams(wikitext, templateName);
  if (!params) return { inflections: [] };

  const inflections: Inflection[] = [];
  const seen = new Set<string>();
  for (const [key, rawValue] of Object.entries(params)) {
    const tags = PARAM_TAGS[key];
    if (!tags) continue;
    const form = renderWikitext(rawValue);
    if (!form) continue;
    const dedupeKey = `${form}|${tags.join(',')}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    inflections.push({ form, tags });
  }

  const genderRaw = params.gen ?? '';
  const genderKey = genderRaw.match(/\{\{\s*([fmn])\s*\}\}/i)?.[1]?.toLowerCase();
  const gender = genderKey ? GENDER_TEMPLATES[genderKey] : undefined;

  // {{verb-ron|…|cj=III}} -- the traditional conjugation class.
  const classRoman = params.cj?.trim();

  return {
    inflections,
    ...(gender ? { gender } : {}),
    ...(classRoman ? { classRoman } : {}),
  };
}
