import { TTL_SECONDS } from '../../cache/ttl.js';
import { BaseProvider } from '../base.js';
import type { ProviderMeta } from '../types.js';
import { parseWiktionary } from './parse.js';
import { buildWiktionaryUrl } from './url.js';

export class WiktionaryProvider extends BaseProvider {
  readonly meta: ProviderMeta = {
    id: 'wiktionary',
    name: 'Wikționar (Wiktionary RO)',
    homepage: 'https://ro.wiktionary.org',
    license: 'CC-BY-SA-4.0',
    attribution: 'Wikționar contributors, ro.wiktionary.org (CC BY-SA 4.0)',
    capabilities: new Set([
      'definitions',
      'etymology',
      'pronunciation_text',
      'inflections',
      'examples',
    ]),
    ttlSeconds: TTL_SECONDS.wiktionary,
    rateLimit: { minIntervalMs: 250, concurrency: 4 },
    enabled: true,
  };

  buildUrl(word: string): string {
    return buildWiktionaryUrl(word);
  }

  parse(body: string, word: string) {
    return parseWiktionary(body, word);
  }
}
