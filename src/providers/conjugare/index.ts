import { TTL_SECONDS } from '../../cache/ttl.js';
import { getDb } from '../../cache/sqlite.js';
import { deterministicId } from '../../lib/id.js';
import { normalizeHeadword } from '../../lib/headword.js';
import type { NormalizedEntry } from '../../schema/entry.js';
import type { LookupOpts, ProviderMeta } from '../types.js';
import { conjugateRomanianVerb } from './rules.js';

export class ConjugareProvider {
  readonly meta: ProviderMeta = {
    id: 'conjugare',
    name: 'Conjugare RO (rules + seed)',
    homepage: 'urn:local:conjugare',
    license: 'MIT',
    attribution: 'Romanian verb-conjugation rules and seed forms from DEX dump.',
    capabilities: new Set(['conjugation', 'inflections']),
    ttlSeconds: TTL_SECONDS.conjugare,
    rateLimit: { minIntervalMs: 0, concurrency: 999 },
    enabled: true,
  };

  buildUrl(_word: string): string {
    return 'urn:local:conjugare';
  }

  parse(_body: string, word: string): NormalizedEntry[] {
    return this.computeEntries(word, 'rules');
  }

  async lookup(word: string, _opts: LookupOpts): Promise<NormalizedEntry[]> {
    const seeded = lookupSeeded(word);
    if (seeded) return [seeded];
    return this.computeEntries(word, 'rules');
  }

  private computeEntries(word: string, source: 'rules' | 'seeded'): NormalizedEntry[] {
    const result = conjugateRomanianVerb(word);
    if (!result) return [];
    const lower = normalizeHeadword(word);
    return [
      {
        id: deterministicId(['conjugare', lower, 0]),
        headword: lower,
        displayHeadword: word,
        partOfSpeech: 'verb',
        inflections: Object.entries(result.forms).map(([key, form]) => ({
          form: form ?? '',
          tags: [key],
        })),
        pronunciations: [],
        senses: [],
        conjugation: {
          classRoman: result.classRoman,
          forms: Object.fromEntries(
            Object.entries(result.forms).filter(([, v]) => typeof v === 'string'),
          ) as Record<string, string>,
        },
        source: {
          providerId: 'conjugare',
          providerName: 'Conjugare RO (rules + seed)',
          url: source === 'seeded' ? 'urn:local:conjugare:seeded' : 'urn:local:conjugare:rules',
          license: 'MIT',
          attribution: source === 'seeded' ? 'Seeded from DEX dump' : 'Rule-based',
          fetchedAt: new Date().toISOString(),
          cacheHit: false,
        },
      },
    ];
  }
}

function lookupSeeded(word: string): NormalizedEntry | undefined {
  try {
    const db = getDb();
    const rows = db
      .prepare('SELECT form_key as key, form, class_roman as cls FROM verb_forms WHERE lemma = ?')
      .all(normalizeHeadword(word)) as Array<{ key: string; form: string; cls: string | null }>;
    if (rows.length === 0) return undefined;
    const forms: Record<string, string> = {};
    let cls: string | undefined;
    for (const r of rows) {
      forms[r.key] = r.form;
      if (r.cls) cls = r.cls;
    }
    const lower = normalizeHeadword(word);
    return {
      id: deterministicId(['conjugare', lower, 0]),
      headword: lower,
      displayHeadword: word,
      partOfSpeech: 'verb',
      inflections: Object.entries(forms).map(([key, form]) => ({ form, tags: [key] })),
      pronunciations: [],
      senses: [],
      conjugation: { ...(cls ? { classRoman: cls } : {}), forms },
      source: {
        providerId: 'conjugare',
        providerName: 'Conjugare RO (seeded)',
        url: 'urn:local:conjugare:seeded',
        license: 'GPL-2.0-or-later',
        attribution: 'Seeded from DEXonline GPL dump InflectedForm table.',
        fetchedAt: new Date().toISOString(),
        cacheHit: true,
      },
    };
  } catch {
    return undefined;
  }
}
