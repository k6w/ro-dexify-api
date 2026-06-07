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
  const match = buildFtsQuery(parsed.q);
  // A query made entirely of operators or punctuation leaves nothing to search
  // for. That is an empty result, not a 500.
  if (!match) {
    return c.json({ query: parsed.q, count: 0, results: [] });
  }

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT headword, sense_text as senseText, provider_id as providerId, entry_id as entryId,
              bm25(entries_fts) as score
       FROM entries_fts WHERE entries_fts MATCH ? ORDER BY score LIMIT ? OFFSET ?`,
    )
    .all(match, parsed.limit, parsed.offset) as Array<{
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

/**
 * Build a safe FTS5 MATCH expression.
 *
 * The previous version stripped only `"`, `(` and `)` and then appended `*` to
 * every token, so a query of `a*b"OR` or `^^^` reached SQLite as a malformed
 * expression and the route answered 500. FTS5 also treats `AND`/`OR`/`NOT`/
 * `NEAR` as operators, `:` as a column filter and `^` as a column-head anchor.
 *
 * Each token is quoted as an FTS5 string literal, which makes every one of
 * those inert, and the prefix `*` is applied outside the quotes where it is
 * still a prefix operator.
 */
function buildFtsQuery(q: string): string {
  // Keep letters, marks, digits and intra-word separators; drop FTS operators.
  const cleaned = q.replace(/[^\p{L}\p{M}\p{N}\s'-]+/gu, ' ');
  const tokens = cleaned
    .split(/\s+/)
    .map((t) => t.replace(/^[-']+|[-']+$/g, ''))
    .filter(Boolean);
  if (tokens.length === 0) return '';

  // Double any embedded quote, then wrap: "casa"* -- prefix match, with any
  // operator inside the literal treated as ordinary text.
  return tokens.map((t) => `"${t.replace(/"/g, '""')}"*`).join(' ');
}
