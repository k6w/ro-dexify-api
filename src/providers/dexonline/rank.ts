/**
 * Source authority ranking and near-duplicate collapsing for DEXonline.
 *
 * A single lookup for "casă" returns 120 definitions drawn from 32 different
 * dictionaries, ranging from the current normative DEX '09 to Șăineanu (1929)
 * and Scriban (1939). Returned raw and unordered, the useful entries are buried
 * among century-old ones that contradict them.
 *
 * Authority is on a 0-100 scale, highest first:
 *   90+  current normative works (DOOM 3, DEX '09, DEXI, MDA2)
 *   70+  recent standard dictionaries (DEX '96/'98, MDN, NODEX, DN)
 *   50+  mid-century academic works (DLRLC, DLRM, DER)
 *   30+  specialist and thematic dictionaries
 *   10+  historical works, useful but superseded (CADE, Scriban, Șăineanu)
 */

interface SourceMeta {
  authority: number;
  year?: number;
}

const SOURCES: Record<string, SourceMeta> = {
  'DOOM 3': { authority: 98, year: 2021 },
  'DOOM 2': { authority: 80, year: 2005 },
  "DEX '09": { authority: 95, year: 2009 },
  DEXI: { authority: 92, year: 2007 },
  MDA2: { authority: 90, year: 2010 },
  "DEX '98": { authority: 78, year: 1998 },
  "DEX '96": { authority: 76, year: 1996 },
  "MDN '00": { authority: 74, year: 2000 },
  MDN: { authority: 74 },
  NODEX: { authority: 72, year: 2002 },
  DN: { authority: 70 },
  Ortografic: { authority: 68 },
  MDO: { authority: 66 },
  DLRLC: { authority: 60, year: 1957 },
  DLRM: { authority: 58, year: 1958 },
  DER: { authority: 52, year: 1966 },
  DE: { authority: 50 },
  DCR2: { authority: 45, year: 2013 },
  DCR: { authority: 44 },
  'DRAM 2021': { authority: 42, year: 2021 },
  'DRAM 2015': { authority: 40, year: 2015 },
  DRAM: { authority: 38 },
  DGS: { authority: 36 },
  DTM: { authority: 34 },
  'D.Religios': { authority: 32 },
  Onomastic: { authority: 30 },
  CECC: { authority: 28 },
  'IVO-III': { authority: 26 },
  Sinonime: { authority: 24 },
  Sinonime82: { authority: 22, year: 1982 },
  Argou: { authority: 20 },
  CADE: { authority: 18, year: 1926 },
  Scriban: { authority: 14, year: 1939 },
  'Șăineanu, ed. VI': { authority: 12, year: 1929 },
};

/** Fallback for a dictionary not in the table. */
const DEFAULT_AUTHORITY = 25;

/**
 * Re-exported from the response view, which is where the decision now lives:
 * the filter is applied after the cache, not during parsing. Defined in one
 * place so the two cannot drift apart.
 */
export { isOrthographicSource } from '../../server/view.js';

export function sourceAuthority(sourceName: string): number {
  return SOURCES[sourceName]?.authority ?? DEFAULT_AUTHORITY;
}

export function sourceYear(sourceName: string): number | undefined {
  return SOURCES[sourceName]?.year;
}

/**
 * Normalise a sense for comparison: lowercase, diacritic-insensitive, no
 * punctuation. Different dictionaries word the same sense almost identically
 * ("Clădire care servește drept locuință" vs "Clădire destinată pentru a servi
 * de locuință"), so exact matching alone under-collapses; this is deliberately
 * conservative and only removes near-identical strings.
 */
function senseKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface RankableEntry {
  sourceName: string;
  authority: number;
  senseTexts: string[];
}

/**
 * Sort by authority (descending), then by the number of senses, so the richest
 * of two equally-authoritative entries comes first.
 */
export function byAuthority<T extends RankableEntry>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    if (b.authority !== a.authority) return b.authority - a.authority;
    return b.senseTexts.length - a.senseTexts.length;
  });
}

/**
 * Drop entries whose senses are all already covered by a higher-authority
 * entry. Input must be sorted by authority first.
 */
export function dropDuplicates<T extends RankableEntry>(sorted: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];

  for (const entry of sorted) {
    const keys = entry.senseTexts.map(senseKey).filter((k) => k.length > 12);
    // Keep entries with only very short senses; they are cheap and dropping
    // them on a weak key would lose real content.
    if (keys.length === 0) {
      out.push(entry);
      continue;
    }
    const fresh = keys.filter((k) => !seen.has(k));
    if (fresh.length === 0) continue;
    for (const k of keys) seen.add(k);
    out.push(entry);
  }
  return out;
}
