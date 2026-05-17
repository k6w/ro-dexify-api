import { htmlToPlainText } from '../http/sanitize.js';
import { normalizeHeadword } from '../lib/headword.js';
import { deterministicId } from '../lib/id.js';
import type { NormalizedEntry } from '../schema/entry.js';

export function dexInternalRepToText(rep: string): string {
  if (!rep) return '';
  let s = rep
    .replace(/@([^@\n]+)@/g, '$1')
    .replace(/\$([^$\n]+)\$/g, '$1')
    .replace(/#([^#\n]+)#/g, '$1')
    .replace(/%([^%\n]+)%/g, '$1')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/\^([^^\n]+)\^/g, '$1')
    .replace(/\\[A-Za-z]+/g, ' ')
    .replace(/[@$#%^*~]+(?=\s|$)/g, ' ')
    .replace(/(?<=\s)[@$#%^*~]+/g, ' ')
    .replace(/[@$#%^~]/g, '')
    .replace(/\^\d+/g, '')
    .replace(/'(?=[A-ZĂÂÎȘȚ])/g, '');
  s = htmlToPlainText(s);
  return s.replace(/\s+/g, ' ').trim();
}

export interface SeedRow {
  headword: string;
  partOfSpeech?: string | null;
  definitionText: string;
  source?: string | null;
  fetchedAt: string;
}

export function rowToNormalizedEntry(row: SeedRow, idx: number): NormalizedEntry {
  const lower = normalizeHeadword(row.headword);
  return {
    id: deterministicId(['dexonline', lower, idx]),
    headword: lower,
    displayHeadword: row.headword,
    partOfSpeech: 'unknown',
    inflections: [],
    pronunciations: [],
    senses: [
      {
        number: 1,
        text: row.definitionText,
        register: [],
        examples: [],
        synonyms: [],
        antonyms: [],
      },
    ],
    source: {
      providerId: 'dexonline',
      providerName: 'DEXonline (seeded)',
      ...(row.source ? { workTitle: row.source } : {}),
      url: `https://dexonline.ro/definitie/${encodeURIComponent(row.headword)}`,
      license: 'GPL-2.0-or-later',
      attribution: 'DEXonline.ro contributors (GPL); seeded from official SQL dump.',
      fetchedAt: row.fetchedAt,
      cacheHit: true,
    },
  };
}
