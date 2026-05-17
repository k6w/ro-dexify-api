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
  if (!entry?.conjugation) {
    throw new ApiException('WORD_NOT_FOUND', `cannot conjugate "${verb}"`);
  }
  const isSeeded = entry.source.url.endsWith('seeded');
  return c.json({
    verb,
    ...(entry.conjugation.classRoman ? { classRoman: entry.conjugation.classRoman } : {}),
    forms: entry.conjugation.forms,
    source: isSeeded ? 'seeded' : 'rules',
  });
});
