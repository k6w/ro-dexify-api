import { loadConfig } from '../../config.js';
import { TTL_SECONDS } from '../../cache/ttl.js';
import { BaseProvider } from '../base.js';
import type { ProviderMeta } from '../types.js';
import { buildDlrUrl } from './url.js';
import { parseDlr } from './parse.js';

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
    enabled: loadConfig().ENABLE_DLR,
  };

  buildUrl(word: string): string {
    return buildDlrUrl(word);
  }

  parse(body: string, word: string) {
    return parseDlr(body, word);
  }
}
