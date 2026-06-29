/**
 * Response view: ranking, filtering and capping applied *after* the cache.
 *
 * These are presentation choices, not extraction choices, so they must not be
 * baked into what gets cached. `lookups` is keyed on (provider_id, headword)
 * only, so if a `?dict=DEX '09` request stored its filtered result, the next
 * unfiltered request for the same word would be served those few entries from
 * cache. Providers therefore cache everything they parsed, and this runs on the
 * way out.
 *
 * It works on any provider's entries because v2 carries `source.authority` and
 * `source.sourceName` on every entry.
 */
import type { EntryV2 } from '../schema/entry-v2.js';

export interface ViewOptions {
  /** Skip ranking, deduplication and the cap; return everything. */
  all?: boolean;
  /** Restrict to these contributing dictionaries (case-insensitive). */
  dictionaries?: readonly string[];
  /** Cap on entries returned per provider when `all` is not set. */
  limit?: number;
  /** Include sources that carry inflection but no definitions (DOOM etc.). */
  includeOrthographic?: boolean;
}

/** Default cap per provider. */
export const DEFAULT_VIEW_LIMIT = 8;

/**
 * Sources whose DEXonline entries carry orthography and inflection but no
 * definition text. They rank highest by authority, so left in they push every
 * real definition off the front. The dedicated `doom` provider covers the same
 * data from the source site, with stress and syllabification this copy lacks.
 */
const ORTHOGRAPHIC_SOURCE_NAMES: ReadonlySet<string> = new Set([
  'DOOM 3',
  'DOOM 2',
  'DOOM',
  'Ortografic',
  'MDO',
]);

function senseKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function topLevelSenseTexts(entry: EntryV2): string[] {
  return entry.senses.map((s) => s.text);
}

export function applyView(entries: readonly EntryV2[], options: ViewOptions = {}): EntryV2[] {
  let out = [...entries];

  if (!options.includeOrthographic) {
    const filtered = out.filter((e) => !ORTHOGRAPHIC_SOURCE_NAMES.has(e.source.sourceName ?? ''));
    // Never filter a provider down to nothing: the doom provider's own entries
    // legitimately have no senses.
    if (filtered.length > 0) out = filtered;
  }

  if (options.dictionaries && options.dictionaries.length > 0) {
    const wanted = new Set(options.dictionaries.map((d) => d.toLowerCase()));
    out = out.filter((e) => wanted.has((e.source.sourceName ?? '').toLowerCase()));
  }

  // Highest authority first; between equals, the entry with more senses.
  out.sort((a, b) => {
    if (b.source.authority !== a.source.authority) return b.source.authority - a.source.authority;
    return b.senses.length - a.senses.length;
  });

  if (options.all) return out;

  const seen = new Set<string>();
  const deduped: EntryV2[] = [];
  for (const entry of out) {
    const keys = topLevelSenseTexts(entry)
      .map(senseKey)
      .filter((k) => k.length > 12);
    if (keys.length === 0) {
      deduped.push(entry);
      continue;
    }
    if (keys.every((k) => seen.has(k))) continue;
    for (const k of keys) seen.add(k);
    deduped.push(entry);
  }

  return deduped.slice(0, options.limit ?? DEFAULT_VIEW_LIMIT);
}
