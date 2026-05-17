import { TTL_SECONDS } from '../../cache/ttl.js';
import { normalizeHeadword } from '../../lib/headword.js';
import { deterministicId } from '../../lib/id.js';
import type { Logger } from '../../lib/logger.js';
import type { Inflection, NormalizedEntry } from '../../schema/entry.js';
import type { LookupOpts, ProviderMeta } from '../types.js';

export interface PluralResult {
  singular: string;
  plural: string;
  gender?: 'feminin' | 'masculin' | 'neutru';
  confident: boolean;
}

export class PluralRoProvider {
  readonly meta: ProviderMeta = {
    id: 'pluralro',
    name: 'plural-ro (rule-based)',
    homepage: 'https://github.com/alexcambose/plural-ro',
    license: 'MIT',
    attribution: 'Romanian pluralization rules; deterministic, no network.',
    capabilities: new Set(['pluralization', 'inflections']),
    ttlSeconds: TTL_SECONDS.pluralro,
    rateLimit: { minIntervalMs: 0, concurrency: 999 },
    enabled: true,
  };

  buildUrl(_word: string): string {
    return 'urn:local:pluralro';
  }

  parse(_body: string, word: string): NormalizedEntry[] {
    const result = pluralize(word);
    if (!result) return [];
    return [toEntry(word, result)];
  }

  async lookup(word: string, _opts: LookupOpts): Promise<NormalizedEntry[]> {
    const entry = this.parse('', word);
    return entry;
  }
}

function toEntry(word: string, p: PluralResult): NormalizedEntry {
  const lower = normalizeHeadword(word);
  const inflections: Inflection[] = [
    { form: p.plural, tags: ['plural', p.confident ? 'rule:high' : 'rule:low'] },
  ];
  return {
    id: deterministicId(['pluralro', lower, 0]),
    headword: lower,
    displayHeadword: word,
    partOfSpeech: 'substantiv',
    ...(p.gender ? { gender: p.gender } : {}),
    inflections,
    pronunciations: [],
    senses: [],
    source: {
      providerId: 'pluralro',
      providerName: 'plural-ro (rule-based)',
      url: 'urn:local:pluralro',
      license: 'MIT',
      attribution: 'Romanian pluralization rules; deterministic, no network.',
      fetchedAt: new Date().toISOString(),
      cacheHit: false,
    },
  };
}

export function pluralize(word: string): PluralResult | undefined {
  const w = word.normalize('NFC').toLocaleLowerCase('ro-RO').trim();
  if (!w) return undefined;
  if (w.endsWith('ă')) {
    return { singular: w, plural: `${w.slice(0, -1)}e`, gender: 'feminin', confident: true };
  }
  if (w.endsWith('a')) {
    return { singular: w, plural: `${w.slice(0, -1)}ale`, gender: 'feminin', confident: false };
  }
  if (w.endsWith('ie')) {
    return { singular: w, plural: `${w.slice(0, -2)}ii`, gender: 'feminin', confident: true };
  }
  if (w.endsWith('e')) {
    return { singular: w, plural: `${w.slice(0, -1)}i`, gender: 'feminin', confident: true };
  }
  if (w.endsWith('u')) {
    return { singular: w, plural: `${w.slice(0, -1)}i`, gender: 'masculin', confident: false };
  }
  if (/[aeiouăîâ]r$/.test(w)) {
    return { singular: w, plural: `${w}i`, confident: false };
  }
  if (w.endsWith('al') || w.endsWith('iu') || w.endsWith('ol')) {
    return { singular: w, plural: `${w.slice(0, -1)}e`, gender: 'neutru', confident: false };
  }
  return { singular: w, plural: `${w}uri`, gender: 'neutru', confident: false };
}

export function withLoggerNoop(_logger: Logger): void {}
