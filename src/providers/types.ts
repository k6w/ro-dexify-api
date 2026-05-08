import type { Logger } from '../lib/logger.js';
import type { Capability, NormalizedEntry, ProviderId } from '../schema/entry.js';

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
  parse(body: string, word: string): NormalizedEntry[];
  lookup(word: string, opts: LookupOpts): Promise<NormalizedEntry[]>;
}
