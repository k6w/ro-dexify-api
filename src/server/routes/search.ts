import { Hono } from 'hono';
import { getDb } from '../../cache/sqlite.js';
import { SearchQuery } from '../../schema/api.js';

export const searchRoutes = new Hono();

searchRoutes.get('/search', (c) => {
  const parsed = SearchQuery.parse({
    q: c.req.query('q'),
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  });
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT headword, sense_text as senseText, provider_id as providerId, entry_id as entryId,
              bm25(entries_fts) as score
       FROM entries_fts WHERE entries_fts MATCH ? ORDER BY score LIMIT ? OFFSET ?`,
    )
    .all(buildFtsQuery(parsed.q), parsed.limit, parsed.offset) as Array<{
    headword: string;
    senseText: string;
    providerId: string;
    entryId: string;
    score: number;
  }>;
  return c.json({
    query: parsed.q,
    count: rows.length,
    results: rows.map((r) => ({
      headword: r.headword,
      providerId: r.providerId,
      preview: r.senseText.slice(0, 200),
      score: r.score,
    })),
  });
});

function buildFtsQuery(q: string): string {
  const sanitized = q.replace(/["()]/g, ' ').trim();
  if (!sanitized) return '';
  const tokens = sanitized.split(/\s+/).filter(Boolean);
  return tokens.map((t) => `${t}*`).join(' ');
}
