import { TTL_SECONDS } from '../../cache/ttl.js';
import { BaseProvider } from '../base.js';
import type { ProviderMeta } from '../types.js';
import { parseMdex } from './parse.js';
import { buildMdexUrl } from './url.js';

export class MdexProvider extends BaseProvider {
  readonly meta: ProviderMeta = {
    id: 'mdex',
    name: 'm.dex.ro',
    homepage: 'https://m.dex.ro',
    license: 'GPL-2.0-or-later',
    attribution: 'm.dex.ro (mirror of DEXonline)',
    capabilities: new Set(['definitions', 'examples']),
    ttlSeconds: TTL_SECONDS.mdex,
    rateLimit: { minIntervalMs: 2000, concurrency: 1 },
    // m.dex.ro mirrors the same DEXonline corpus the `dexonline` provider now
    // reads as structured JSON, in markup that carries strictly less
    // information. Including it by default duplicated every definition and
    // doubled the request budget for no extra coverage, so it is opt-in via
    // ?sources=mdex and serves as a fallback when dexonline is unavailable.
    enabled: false,
  };

  buildUrl(word: string): string {
    return buildMdexUrl(word);
  }

  parse(body: string, word: string) {
    return parseMdex(body, word);
  }
}
