import { TTL_SECONDS } from '../../cache/ttl.js';
import { BaseProvider } from '../base.js';
import type { ProviderMeta } from '../types.js';
import { buildMdexUrl } from './url.js';
import { parseMdex } from './parse.js';

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
    enabled: true,
  };

  buildUrl(word: string): string {
    return buildMdexUrl(word);
  }

  parse(body: string, word: string) {
    return parseMdex(body, word);
  }
}
