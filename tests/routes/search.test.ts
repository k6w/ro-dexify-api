import { beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { getDb } from '../../src/cache/sqlite.js';
import { getLogger } from '../../src/lib/logger.js';

const app = buildApp({ logger: getLogger() });

beforeAll(() => {
  const db = getDb();
  db.prepare(
    'INSERT INTO entries_fts (headword, sense_text, provider_id, entry_id) VALUES (?, ?, ?, ?)',
  ).run('casă', 'Clădire care servește drept locuință.', 'dexonline', 'test-entry-1');
});

async function search(q: string): Promise<{ status: number; body: { count: number } }> {
  const res = await app.request(`/v1/search?q=${encodeURIComponent(q)}&limit=5`);
  return { status: res.status, body: (await res.json()) as { count: number } };
}

describe('GET /v1/search', () => {
  it('folds diacritics: an unaccented query finds the accented word', async () => {
    const { status, body } = await search('casa');
    expect(status).toBe(200);
    expect(body.count).toBeGreaterThan(0);
  });

  it('folds diacritics inside the sense text too', async () => {
    expect((await search('locuinta')).body.count).toBeGreaterThan(0);
  });

  it('never 500s on FTS5 metacharacters', async () => {
    // Regression: these reached SQLite as malformed MATCH expressions.
    for (const q of ['a*b"OR', 'NEAR(', '^^^', 'AND OR NOT', 'casa:x', '***', '"', '-']) {
      const { status } = await search(q);
      expect(status, `query ${JSON.stringify(q)} should not error`).toBe(200);
    }
  });

  it('returns an empty result for an operator-only query', async () => {
    expect((await search('^^^')).body.count).toBe(0);
  });

  it('treats FTS operators as literal text, not syntax', async () => {
    expect((await search('AND OR NOT')).body.count).toBe(0);
  });
});
