import wtf from 'wtf_wikipedia';
import { deterministicId } from '../../lib/id.js';
import type {
  Etymology,
  NormalizedEntry,
  PartOfSpeech,
  Pronunciation,
  Sense,
} from '../../schema/entry.js';

const POS_FROM_TEMPLATE: Record<string, PartOfSpeech> = {
  'ro-substantiv': 'substantiv',
  'ro-verb': 'verb',
  'ro-adj': 'adjectiv',
  'ro-adv': 'adverb',
  'ro-pron': 'pronume',
  'ro-num': 'numeral',
  'ro-prep': 'prepoziție',
  'ro-conj': 'conjuncție',
  'ro-interj': 'interjecție',
};

interface ApiResponse {
  parse?: {
    title?: string;
    wikitext?: string;
    sections?: Array<{ line: string; level: string; index: string; anchor: string }>;
  };
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
  const wikitext = parsed.parse.wikitext;
  const display = parsed.parse.title || word;
  const lower = display.toLocaleLowerCase('ro-RO');
  const doc = wtf(wikitext);
  const fetchedAt = new Date().toISOString();
  const text = doc.text();

  const pos = inferPos(wikitext);
  const senses = extractSenses(doc);
  const etymology = extractEtymology(text);
  const pronunciations = extractPronunciations(wikitext);

  if (senses.length === 0 && pronunciations.length === 0 && !etymology) return [];

  return [
    {
      id: deterministicId(['wiktionary', lower, 0]),
      headword: lower,
      displayHeadword: display,
      partOfSpeech: pos,
      inflections: [],
      pronunciations,
      senses,
      ...(etymology ? { etymology } : {}),
      source: {
        providerId: 'wiktionary',
        providerName: 'Wikționar (Wiktionary RO)',
        url: `https://ro.wiktionary.org/wiki/${encodeURIComponent(display)}`,
        license: 'CC-BY-SA-4.0',
        attribution: 'Wikționar contributors, ro.wiktionary.org',
        fetchedAt,
        cacheHit: false,
      },
    },
  ];
}

function inferPos(wikitext: string): PartOfSpeech {
  for (const [tpl, pos] of Object.entries(POS_FROM_TEMPLATE)) {
    if (new RegExp(`\\{\\{\\s*${escapeRegex(tpl)}\\b`, 'i').test(wikitext)) return pos;
  }
  if (/==\s*Substantiv\s*==/i.test(wikitext)) return 'substantiv';
  if (/==\s*Verb\s*==/i.test(wikitext)) return 'verb';
  if (/==\s*Adjectiv\s*==/i.test(wikitext)) return 'adjectiv';
  if (/==\s*Adverb\s*==/i.test(wikitext)) return 'adverb';
  return 'unknown';
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractSenses(doc: ReturnType<typeof wtf>): Sense[] {
  const out: Sense[] = [];
  const sections = doc.sections() ?? [];
  for (const section of toArray(sections)) {
    const lists = toArray(section.lists?.() ?? []);
    for (const list of lists) {
      const linesRaw = (list as { lines?: () => unknown }).lines?.() ?? [];
      const lines = toArray(linesRaw);
      for (const line of lines) {
        const text = ((line as { text?: () => string }).text?.() ?? '').trim();
        if (!text) continue;
        out.push({
          number: out.length + 1,
          text,
          register: [],
          examples: [],
          synonyms: [],
          antonyms: [],
        });
      }
    }
  }
  return out;
}

function toArray<T>(v: T | T[]): T[] {
  if (Array.isArray(v)) return v;
  if (v === null || v === undefined) return [];
  return [v];
}

function extractEtymology(plainText: string): Etymology | undefined {
  const m = plainText.match(/Etimologie[\s:\n]+([^\n]+)/i);
  if (!m?.[1]) return undefined;
  return { text: m[1].trim(), languages: [] };
}

function extractPronunciations(wikitext: string): Pronunciation[] {
  const out: Pronunciation[] = [];
  const ipaRe = /\{\{\s*IPA\s*\|\s*([^}|]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = ipaRe.exec(wikitext)) !== null) {
    const ipa = m[1]?.trim();
    if (ipa) out.push({ ipa });
  }
  return out;
}
