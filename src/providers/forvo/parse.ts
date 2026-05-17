import { deterministicId } from '../../lib/id.js';
import type { NormalizedEntry, Pronunciation } from '../../schema/entry.js';

interface ForvoItem {
  id: number;
  word?: string;
  pathmp3?: string;
  pathogg?: string;
  username?: string;
  language?: string;
  num_positive_votes?: number;
}

interface ForvoResponse {
  attributes?: { total?: number };
  items?: ForvoItem[];
}

export function parseForvo(body: string, word: string): NormalizedEntry[] {
  let parsed: ForvoResponse;
  try {
    parsed = JSON.parse(body) as ForvoResponse;
  } catch {
    return [];
  }
  const items = parsed.items ?? [];
  if (items.length === 0) return [];

  const lower = word.toLocaleLowerCase('ro-RO');
  const display = items[0]?.word ?? word;
  const pronunciations: Pronunciation[] = items
    .filter((i) => i.pathmp3)
    .map((i) => ({
      ...(i.pathmp3 ? { audioUrl: i.pathmp3 } : {}),
      audioMime: 'audio/mpeg',
      ...(i.username ? { audioAttribution: `Forvo: ${i.username}` } : {}),
    }));

  if (pronunciations.length === 0) return [];

  const fetchedAt = new Date().toISOString();
  return [
    {
      id: deterministicId(['forvo', lower, 0]),
      headword: lower,
      displayHeadword: display,
      partOfSpeech: 'unknown',
      inflections: [],
      pronunciations,
      senses: [],
      source: {
        providerId: 'forvo',
        providerName: 'Forvo',
        url: `https://forvo.com/word/${encodeURIComponent(display)}/#ro`,
        license: 'proprietary-attribution',
        attribution: 'Forvo Pronunciation API; per-clip credit to user.',
        fetchedAt,
        cacheHit: false,
      },
    },
  ];
}
