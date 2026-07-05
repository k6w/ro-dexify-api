import { TTL_SECONDS } from '../../cache/ttl.js';
import { loadConfig } from '../../config.js';
import { liftEntries } from '../../schema/adapters/lift.js';
import { BaseProvider } from '../base.js';
import type { ProviderMeta } from '../types.js';
import { parseDlr } from './parse.js';
import { buildDlrUrl } from './url.js';

/**
 * DLR / TEZAUR.
 *
 * UNAVAILABLE as of this writing, and disabled regardless of ENABLE_DLR.
 *
 * The provider was written against `dlr1.solirom.ro/index.php?cuv=<word>`,
 * which now returns HTTP 404 for every word -- verified against the live host.
 * The site has been rebuilt as a browser-only application: the page loads
 * `minisearch` and Shoelace web components and resolves words client-side
 * against an index hosted elsewhere. There is no server-rendered page for a
 * word to fetch, so there is nothing to record as a fixture and nothing for a
 * server-side parser to read.
 *
 * Left in place rather than deleted because the corpus is worth having if a
 * queryable endpoint reappears. Re-enabling it needs a real endpoint first:
 * either a documented API on solirom's backend, or accepting a headless
 * browser as a dependency. `parse.ts` has never been run against real bytes and
 * must be treated as unverified.
 */
/** Flip to true only once a fetchable endpoint exists again. */
const DLR_ENDPOINT_AVAILABLE = false;

export class DlrProvider extends BaseProvider {
  readonly meta: ProviderMeta = {
    id: 'dlr',
    name: 'DLR / TEZAUR',
    homepage: 'https://dlr1.solirom.ro',
    license: 'academic',
    attribution: 'Dicționarul Limbii Române (Academia Română); via dlr1.solirom.ro',
    capabilities: new Set(['definitions', 'etymology', 'examples']),
    ttlSeconds: TTL_SECONDS.dlr,
    rateLimit: { minIntervalMs: 3000, concurrency: 1 },
    // Both conditions must hold, and the second currently never does: the
    // upstream endpoint 404s, so enabling this would only add a failing
    // provider to every response's errors[].
    enabled: loadConfig().ENABLE_DLR && DLR_ENDPOINT_AVAILABLE,
  };

  buildUrl(word: string): string {
    return buildDlrUrl(word);
  }

  parse(body: string, word: string) {
    return liftEntries(parseDlr(body, word), { authority: 60 });
  }
}
