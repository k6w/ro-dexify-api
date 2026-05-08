import { Hono } from 'hono';
import '../context.js';
import { ApiException } from '../../schema/errors.js';
import { ProviderId } from '../../schema/entry.js';
import { HeadwordParam, WordLookupQuery } from '../../schema/api.js';
import { aggregate, aggregateOne } from '../aggregator.js';

export const wordRoutes = new Hono();

wordRoutes.get('/word/:word', async (c) => {
  const wordRaw = decodeURIComponent(c.req.param('word'));
  const word = HeadwordParam.parse(wordRaw);
  const queryParsed = WordLookupQuery.parse({
    sources: c.req.query('sources'),
    refresh: c.req.query('refresh'),
    include: c.req.query('include'),
  });
  const logger = c.get('logger');
  const result = await aggregate({
    word,
    ...(queryParsed.sources ? { sources: queryParsed.sources } : {}),
    ...(queryParsed.refresh ? { refresh: queryParsed.refresh } : {}),
    ...(queryParsed.include ? { include: queryParsed.include } : {}),
    logger,
  });
  return c.json({
    headword: word,
    entries: result.entries,
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
  });
  const logger = c.get('logger');
  const result = await aggregateOne(sourceParsed.data, {
    word,
    ...(queryParsed.refresh ? { refresh: queryParsed.refresh } : {}),
    ...(queryParsed.include ? { include: queryParsed.include } : {}),
    logger,
  });
  return c.json({
    headword: word,
    entries: result.entries,
    cache: result.cache,
    errors: result.errors,
  });
});
