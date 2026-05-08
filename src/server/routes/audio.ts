import { Hono } from 'hono';
import '../context.js';
import { HeadwordParam } from '../../schema/api.js';
import { aggregateOne } from '../aggregator.js';

export const audioRoutes = new Hono();

audioRoutes.get('/audio/:word', async (c) => {
  const word = HeadwordParam.parse(decodeURIComponent(c.req.param('word')));
  const logger = c.get('logger');
  const result = await aggregateOne('forvo', { word, logger });
  const pronunciations = result.entries.flatMap((e) =>
    e.pronunciations
      .filter((p) => p.audioUrl)
      .map((p) => ({
        audioUrl: p.audioUrl,
        ...(p.audioMime ? { audioMime: p.audioMime } : {}),
        ...(p.audioAttribution ? { audioAttribution: p.audioAttribution } : {}),
      })),
  );
  return c.json({
    word,
    pronunciations,
    errors: result.errors,
  });
});
