import { Hono } from 'hono';
import '../context.js';
import { HeadwordParam } from '../../schema/api.js';
import { ApiException } from '../../schema/errors.js';
import { aggregateOne } from '../aggregator.js';

export const conjugateRoutes = new Hono();

conjugateRoutes.get('/conjugate/:verb', async (c) => {
  const verb = HeadwordParam.parse(decodeURIComponent(c.req.param('verb')));
  const logger = c.get('logger');
  const result = await aggregateOne('conjugare', { word: verb, logger });
  const entry = result.entries[0];
  if (!entry?.paradigm) {
    throw new ApiException('WORD_NOT_FOUND', `cannot conjugate "${verb}"`);
  }
  const isSeeded = entry.source.url.endsWith('seeded');
  // v2 stores the paradigm as tagged cells; /v1 keeps the flat key -> form map.
  const forms: Record<string, string> = {};
  for (const cell of entry.paradigm.cells) {
    const key = cell.tags[0];
    const form = cell.forms[0];
    if (key && form) forms[key] = form;
  }
  return c.json({
    verb,
    ...(entry.paradigm.classRoman ? { classRoman: entry.paradigm.classRoman } : {}),
    forms,
    source: isSeeded ? 'seeded' : 'rules',
  });
});
