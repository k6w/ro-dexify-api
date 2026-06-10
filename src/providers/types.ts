import type { Logger } from '../lib/logger.js';
import type { EntryV2 } from '../schema/entry-v2.js';
import type { Capability, ProviderId } from '../schema/entry.js';

export interface ProviderMeta {
  id: ProviderId;
  name: string;
  homepage: string;
  license: string;
  attribution: string;
  capabilities: ReadonlySet<Capability>;
  ttlSeconds: number;
  rateLimit: { minIntervalMs: number; concurrency: number };
  enabled: boolean;
  /**
   * How this provider treats robots.txt.
   *
   * - 'crawler' (default): obey robots.txt. Correct for every provider that
   *   fetches rendered pages meant for human readers.
   * - 'official-api': the endpoint is a documented programmatic API whose
   *   operator governs access through User-Agent and rate-limit policy rather
   *   than robots.txt. Wikimedia's robots.txt carries `Disallow: /w/` and
   *   `Disallow: /api/` to keep search engines from indexing dynamic
   *   duplicates of wiki content -- it is not an access-control list, and
   *   api.php is the interface Wikimedia publishes for exactly this use. The
   *   descriptive User-Agent and per-host rate limit still apply.
   *
   * Set this only for an endpoint the operator documents as an API.
   */
  robotsPolicy?: 'crawler' | 'official-api';
}

export interface LookupOpts {
  signal: AbortSignal;
  refresh?: boolean;
  include?: ReadonlyArray<Capability>;
  logger: Logger;
}

export interface FetchedBody {
  url: string;
  status: number;
  body: string;
  etag?: string;
  lastModified?: string;
  fetchedAt: string;
}

export interface Provider {
  readonly meta: ProviderMeta;
  buildUrl(word: string): string;
  parse(body: string, word: string): EntryV2[];
  lookup(word: string, opts: LookupOpts): Promise<EntryV2[]>;
}
