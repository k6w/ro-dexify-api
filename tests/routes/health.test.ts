import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { getLogger } from '../../src/lib/logger.js';

describe('GET /v1/healthz', () => {
  const app = buildApp({ logger: getLogger() });

  it('returns ok status', async () => {
    const res = await app.request('/v1/healthz');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; db: string };
    expect(['ok', 'degraded']).toContain(body.status);
    expect(body.db).toBe('ok');
  });
});

describe('GET /v1/sources', () => {
  const app = buildApp({ logger: getLogger() });
  it('lists all 8 providers', async () => {
    const res = await app.request('/v1/sources');
    const body = (await res.json()) as { sources: { id: string }[] };
    expect(body.sources.length).toBe(8);
    const ids = body.sources.map((s) => s.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'doom',
        'dexonline',
        'mdex',
        'wiktionary',
        'forvo',
        'dlr',
        'conjugare',
        'pluralro',
      ]),
    );
  });
});
