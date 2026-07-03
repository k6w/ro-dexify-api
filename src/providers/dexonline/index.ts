import { TTL_SECONDS } from '../../cache/ttl.js';
import type { EntryV2 } from '../../schema/entry-v2.js';
import { BaseProvider } from '../base.js';
import type { ProviderMeta } from '../types.js';
import { enrichWithPage } from './enrich.js';
import { parseDexonline } from './parse.js';
import { buildDexonlineJsonUrl, buildDexonlineUrl } from './url.js';

export class DexonlineProvider extends BaseProvider {
  readonly meta: ProviderMeta = {
    id: 'dexonline',
    name: 'DEXonline',
    homepage: 'https://dexonline.ro',
    license: 'GPL-2.0-or-later',
    attribution: 'DEXonline.ro contributors; aggregated from DEX, DOOM, DLR and others.',
    capabilities: new Set([
      'definitions',
      'etymology',
      'examples',
      'inflections',
      'register_notes',
    ]),
    ttlSeconds: TTL_SECONDS.dexonline,
    rateLimit: { minIntervalMs: 2000, concurrency: 1 },
    enabled: true,
  };

  // The JSON endpoint carries DEXonline's structured internalRep markup and is
  // ~35% smaller than the rendered page.
  buildUrl(word: string): string {
    return buildDexonlineJsonUrl(word);
  }

  protected override extraHeaders(): Record<string, string> {
    return { accept: 'application/json' };
  }

  // Builds EntryV2 directly: DEXonline's ◊ locutions and ♦ sub-senses are real
  // structure that must not be flattened on the way in.
  parse(body: string, word: string) {
    // Parse and cache everything the lookup matched. Ranking, deduplication,
    // the dictionary filter and the cap are view concerns applied after the
    // cache -- see src/server/view.ts -- because the cache is keyed on
    // (provider, headword) and would otherwise serve a filtered result to an
    // unfiltered request.
    return parseDexonline(body, word, { all: true, includeOrthographic: true });
  }

  /**
   * The rendered page, fetched after the JSON. It is the only source of typed
   * relations, example citations and the full declension table. Costs a second
   * request 2 s later per robots Crawl-delay; both land in one cache entry.
   */
  protected override secondaryUrl(word: string): string {
    return buildDexonlineUrl(word);
  }

  protected override mergeSecondary(entries: EntryV2[], body: string): EntryV2[] {
    return enrichWithPage(entries, body);
  }
}
