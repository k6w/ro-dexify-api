import { TTL_SECONDS } from '../../cache/ttl.js';
import { BaseProvider } from '../base.js';
import type { ProviderMeta } from '../types.js';
import { parseDoom } from './parse.js';
import { buildDoomUrl } from './url.js';

export class DoomProvider extends BaseProvider {
  readonly meta: ProviderMeta = {
    id: 'doom',
    name: 'DOOM 3',
    homepage: 'https://doom.lingv.ro',
    license: 'CC-BY-NC-SA-4.0',
    attribution: 'Institutul de Lingvistică „Iorgu Iordan – Al. Rosetti", DOOM 3',
    capabilities: new Set(['inflections', 'pronunciation_text']),
    ttlSeconds: TTL_SECONDS.doom,
    rateLimit: { minIntervalMs: 1500, concurrency: 1 },
    enabled: true,
  };

  buildUrl(word: string): string {
    return buildDoomUrl(word);
  }

  parse(body: string, word: string) {
    return parseDoom(body, word);
  }
}
