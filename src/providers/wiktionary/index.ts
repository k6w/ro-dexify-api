import { TTL_SECONDS } from '../../cache/ttl.js';
import { liftEntries } from '../../schema/adapters/lift.js';
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
    // ro.wiktionary.org/w/api.php is the MediaWiki Action API, which Wikimedia
    // documents for programmatic access and rate-limits itself. Their
    // robots.txt Disallow: /w/ exists to stop search engines indexing dynamic
    // duplicates of wiki pages, not to bar API clients.
    robotsPolicy: 'official-api',
  };

  buildUrl(word: string): string {
    return buildWiktionaryUrl(word);
  }

  parse(body: string, word: string) {
    return liftEntries(parseWiktionary(body, word), { authority: 65 });
  }
}
