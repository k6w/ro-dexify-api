import { Hono } from 'hono';
import '../context.js';
import { entriesToV1 } from '../../schema/adapters/v1.js';
import { HeadwordParam, WordLookupQuery } from '../../schema/api.js';
import { ProviderId } from '../../schema/entry.js';
import { ApiException } from '../../schema/errors.js';
import { aggregate, aggregateOne } from '../aggregator.js';
import type { ViewOptions } from '../view.js';

/**
 * `/v1` flattens the v2 sense tree through the adapter so its response shape is
 * unchanged; `/v2` returns entries as the providers built them.
 */
export function buildWordRoutes(version: 'v1' | 'v2'): Hono {
  const routes = new Hono();
  const shape = (entries: Parameters<typeof entriesToV1>[0]) =>
    version === 'v1' ? entriesToV1(entries) : entries;
  wire(routes, shape);
  return routes;
}

export const wordRoutes = buildWordRoutes('v1');
export const wordRoutesV2 = buildWordRoutes('v2');

function wire(
  wordRoutes: Hono,
  shape: (entries: Parameters<typeof entriesToV1>[0]) => unknown,
): void {
  wordRoutes.get('/word/:word', async (c) => {
    const wordRaw = decodeURIComponent(c.req.param('word'));
    const word = HeadwordParam.parse(wordRaw);
    const queryParsed = WordLookupQuery.parse({
      sources: c.req.query('sources'),
      refresh: c.req.query('refresh'),
      include: c.req.query('include'),
      all: c.req.query('all'),
      dict: c.req.query('dict'),
      limit: c.req.query('limit'),
      orthographic: c.req.query('orthographic'),
    });
    const view = toView(queryParsed);
    const logger = c.get('logger');
    const result = await aggregate({
      word,
      ...(queryParsed.sources ? { sources: queryParsed.sources } : {}),
      ...(queryParsed.refresh ? { refresh: queryParsed.refresh } : {}),
      ...(queryParsed.include ? { include: queryParsed.include } : {}),
      view,
      logger,
    });
    return c.json({
      headword: word,
      entries: shape(result.entries),
      cache: result.cache,
      errors: result.errors,
    });
  });

  wordRoutes.get('/word/:word/:source', async (c) => {
    const wordRaw = decodeURIComponent(c.req.param('word'));
    const word = HeadwordParam.parse(wordRaw);
    const sourceRaw = c.req.param('source');
    const sourceParsed = ProviderId.safeParse(sourceRaw);
    if (!sourceParsed.success) {
      throw new ApiException('INVALID_INPUT', `unknown source: ${sourceRaw}`);
    }
    const queryParsed = WordLookupQuery.parse({
      refresh: c.req.query('refresh'),
      include: c.req.query('include'),
      all: c.req.query('all'),
      dict: c.req.query('dict'),
      limit: c.req.query('limit'),
      orthographic: c.req.query('orthographic'),
    });
    const view = toView(queryParsed);
    const logger = c.get('logger');
    const result = await aggregateOne(sourceParsed.data, {
      word,
      ...(queryParsed.refresh ? { refresh: queryParsed.refresh } : {}),
      ...(queryParsed.include ? { include: queryParsed.include } : {}),
      view,
      logger,
    });
    return c.json({
      headword: word,
      entries: shape(result.entries),
      cache: result.cache,
      errors: result.errors,
    });
  });
}

/** Map the parsed query onto the post-cache view options. */
function toView(q: {
  all?: boolean | undefined;
  dict?: string[] | undefined;
  limit?: number | undefined;
  orthographic?: boolean | undefined;
}): ViewOptions {
  return {
    ...(q.all !== undefined ? { all: q.all } : {}),
    ...(q.dict !== undefined ? { dictionaries: q.dict } : {}),
    ...(q.limit !== undefined ? { limit: q.limit } : {}),
    ...(q.orthographic !== undefined ? { includeOrthographic: q.orthographic } : {}),
  };
}
