import { XMLParser } from 'fast-xml-parser';
import { htmlToPlainText } from '../../http/sanitize.js';
import { deterministicId } from '../../lib/id.js';
import type { Inflection, NormalizedEntry, PartOfSpeech } from '../../schema/entry.js';

const POS_MAP: Record<string, PartOfSpeech> = {
  's.f.': 'substantiv',
  's.m.': 'substantiv',
  's.n.': 'substantiv',
  'sf.': 'substantiv',
  'sm.': 'substantiv',
  'sn.': 'substantiv',
  'vb.': 'verb',
  'adj.': 'adjectiv',
  'adv.': 'adverb',
  'prep.': 'prepoziție',
  'conj.': 'conjuncție',
  'interj.': 'interjecție',
  'num.': 'numeral',
  'pron.': 'pronume',
  'art.': 'articol',
};

const GENDER_FROM_POS: Record<string, NormalizedEntry['gender']> = {
  's.f.': 'feminin',
  'sf.': 'feminin',
  's.m.': 'masculin',
  'sm.': 'masculin',
  's.n.': 'neutru',
  'sn.': 'neutru',
};

const xml = new XMLParser({
  ignoreAttributes: false,
  preserveOrder: false,
  trimValues: true,
  textNodeName: '#text',
  parseTagValue: false,
  htmlEntities: true,
});

export function parseDoom(body: string, word: string): NormalizedEntry[] {
  const text = body.trim();
  if (!text) return [];
  const entries: string[] = [];
  try {
    const obj = xml.parse(text) as Record<string, unknown>;
    collectEntries(obj, entries);
  } catch {
    extractEntriesFallback(text, entries);
  }
  if (entries.length === 0) extractEntriesFallback(text, entries);

  const lower = word.toLocaleLowerCase('ro-RO');
  const matched = entries.filter((e) => entryMatchesWord(e, lower));
  const source = matched.length > 0 ? matched : entries;
  return source.map((entryText, idx) => buildEntry(entryText, word, idx));
}

function collectEntries(node: unknown, out: string[]): void {
  if (!node) return;
  if (typeof node === 'string') return;
  if (Array.isArray(node)) {
    for (const item of node) collectEntries(item, out);
    return;
  }
  if (typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    if ('entry' in obj) collectEntries(obj.entry, out);
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'entry') {
        if (Array.isArray(value)) {
          for (const v of value) {
            const t = nodeText(v);
            if (t) out.push(t);
          }
        } else {
          const t = nodeText(value);
          if (t) out.push(t);
        }
      } else if (typeof value === 'object') {
        collectEntries(value, out);
      }
    }
  }
}

function nodeText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return htmlToPlainText(v);
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v.map(nodeText).join(' ').trim();
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    if ('#text' in obj && typeof obj['#text'] === 'string') return htmlToPlainText(obj['#text']);
    return Object.values(obj).map(nodeText).join(' ').trim();
  }
  return '';
}

function extractEntriesFallback(text: string, out: string[]): void {
  const re = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
  for (const m of text.matchAll(re)) {
    if (m[1]) out.push(htmlToPlainText(m[1]));
  }
}

function entryMatchesWord(entryText: string, lowerWord: string): boolean {
  const trimmed = entryText.trim().toLocaleLowerCase('ro-RO');
  if (!trimmed) return false;
  if (trimmed.startsWith(lowerWord)) return true;
  const headword = trimmed.split(/[\s,(;]/)[0] ?? '';
  return headword === lowerWord;
}

function buildEntry(entryText: string, word: string, idx: number): NormalizedEntry {
  const cleaned = entryText.replace(/\s+/g, ' ').trim();
  const headwordMatch = cleaned.match(/^([^\s,;()]+)/);
  const display = headwordMatch?.[1] ?? word;
  const lower = display.toLocaleLowerCase('ro-RO');

  let pos: PartOfSpeech = 'unknown';
  let gender: NormalizedEntry['gender'];
  const inflections: Inflection[] = [];
  let syllabification: string | undefined;

  const sylMatch = cleaned.match(/desp\.?\s*([^)]*)/i);
  if (sylMatch?.[1]) {
    const cand = sylMatch[1].trim().split(/[,;]/)[0]?.trim();
    if (cand?.includes('-')) syllabification = cand;
  }

  const sff = cleaned.match(/(^|[\s(])s\.\s*([fmn])\./i);
  if (sff?.[2]) {
    const key = `s.${sff[2].toLowerCase()}.`;
    pos = POS_MAP[key] ?? pos;
    if (GENDER_FROM_POS[key]) gender = GENDER_FROM_POS[key];
  } else {
    const broad = cleaned.match(/(^|[\s(])(vb|adj|adv|prep|conj|interj|num|pron)\.?/i);
    if (broad?.[2]) {
      const key = `${broad[2].toLowerCase()}.`;
      pos = POS_MAP[key] ?? pos;
    }
  }

  const clauses = cleaned
    .split(';')
    .map((c) => c.trim())
    .filter(Boolean);
  for (const clause of clauses) {
    const tokens = clause
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    for (const token of tokens) {
      const trimmedToken = token.replace(/\s+/g, ' ');
      const plMatch = trimmedToken.match(/^pl\.?\s+(.+)/i);
      if (plMatch?.[1]) {
        for (const form of plMatch[1].split(/\s+/).filter(Boolean)) {
          const clean = form.replace(/[(),;]/g, '').trim();
          if (clean) inflections.push({ form: clean, tags: ['plural'] });
        }
      }
      const gdMatch = trimmedToken.match(/^g\.-?d\.?\s+(.+)/i);
      if (gdMatch?.[1]) {
        const form = gdMatch[1]
          .replace(/^art\.?\s+/i, '')
          .replace(/[(),;]/g, '')
          .trim();
        if (form) inflections.push({ form, tags: ['genitive', 'dative'] });
      }
      const artMatch = trimmedToken.match(/^art\.?\s+(.+)/i);
      if (artMatch?.[1]) {
        const form = artMatch[1].replace(/[(),;]/g, '').trim();
        if (form && form !== display) inflections.push({ form, tags: ['articulated'] });
      }
    }
  }

  const id = deterministicId(['doom', lower, idx]);
  const fetchedAt = new Date().toISOString();
  const entry: NormalizedEntry = {
    id,
    headword: lower,
    displayHeadword: display,
    partOfSpeech: pos,
    inflections,
    pronunciations: syllabification ? [{ syllabification }] : [],
    senses: [],
    source: {
      providerId: 'doom',
      providerName: 'DOOM 3',
      workTitle: 'Dicționarul ortografic, ortoepic și morfologic al limbii române',
      url: `https://doom.lingv.ro/cautare/q/${encodeURIComponent(word)}`,
      license: 'CC-BY-NC-SA-4.0',
      attribution: 'Institutul de Lingvistică „Iorgu Iordan – Al. Rosetti", DOOM 3',
      fetchedAt,
      cacheHit: false,
    },
  };
  if (gender) entry.gender = gender;
  return entry;
}
