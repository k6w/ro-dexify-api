import { TTL_SECONDS } from '../../cache/ttl.js';
import { BaseProvider } from '../base.js';
import type { ProviderMeta } from '../types.js';
import { parseDexonline } from './parse.js';
import { buildDexonlineUrl } from './url.js';

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

  buildUrl(word: string): string {
    return buildDexonlineUrl(word);
  }

  parse(body: string, word: string) {
    return parseDexonline(body, word);
  }
}
