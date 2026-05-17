import { getDb } from '../../cache/sqlite.js';
import { TTL_SECONDS } from '../../cache/ttl.js';
import { loadConfig } from '../../config.js';
import type { NormalizedEntry } from '../../schema/entry.js';
import { ApiException } from '../../schema/errors.js';
import { BaseProvider } from '../base.js';
import type { LookupOpts, ProviderMeta } from '../types.js';
import { parseForvo } from './parse.js';
import { buildForvoUrl } from './url.js';

export class ForvoProvider extends BaseProvider {
  readonly meta: ProviderMeta = {
    id: 'forvo',
    name: 'Forvo',
    homepage: 'https://forvo.com',
    license: 'proprietary-attribution',
    attribution: 'Forvo Pronunciation API; per-clip credit to user.',
    capabilities: new Set(['pronunciation_audio']),
    ttlSeconds: TTL_SECONDS.forvo,
    rateLimit: { minIntervalMs: 200, concurrency: 2 },
    enabled: Boolean(loadConfig().FORVO_API_KEY),
  };

  buildUrl(word: string): string {
    const apiKey = loadConfig().FORVO_API_KEY ?? '';
    return buildForvoUrl(word, apiKey);
  }

  parse(body: string, word: string) {
    return parseForvo(body, word);
  }

  override async lookup(word: string, opts: LookupOpts): Promise<NormalizedEntry[]> {
    const cfg = loadConfig();
    if (!cfg.FORVO_API_KEY) {
      throw new ApiException('PROVIDER_DISABLED', 'forvo: FORVO_API_KEY not set');
    }
    if (!checkAndIncrementQuota(cfg.FORVO_DAILY_QUOTA)) {
      throw new ApiException('RATE_LIMITED', 'forvo daily quota exceeded');
    }
    return super.lookup(word, opts);
  }
}

function checkAndIncrementQuota(limit: number): boolean {
  const db = getDb();
  const ymd = new Date().toISOString().slice(0, 10);
  const row = db
    .prepare('SELECT used FROM provider_quota WHERE provider_id = ? AND ymd = ?')
    .get('forvo', ymd) as { used: number } | undefined;
  const used = row?.used ?? 0;
  if (used >= limit) return false;
  db.prepare(
    `INSERT INTO provider_quota (provider_id, ymd, used) VALUES (?, ?, 1)
     ON CONFLICT(provider_id, ymd) DO UPDATE SET used = used + 1`,
  ).run('forvo', ymd);
  return true;
}
