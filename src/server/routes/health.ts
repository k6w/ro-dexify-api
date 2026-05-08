import { Hono } from 'hono';
import { getDb } from '../../cache/sqlite.js';
import { allBreakerStates } from '../../http/breaker.js';

const startedAt = Date.now();

export const healthRoutes = new Hono();

healthRoutes.get('/healthz', (c) => {
  let dbStatus: 'ok' | 'error' = 'ok';
  try {
    getDb().prepare('SELECT 1').get();
  } catch {
    dbStatus = 'error';
  }
  const breakers = allBreakerStates();
  const status: 'ok' | 'degraded' =
    dbStatus === 'ok' && Object.values(breakers).every((s) => s !== 'open') ? 'ok' : 'degraded';
  const httpStatus = dbStatus === 'ok' ? 200 : 503;
  return c.json(
    {
      status,
      uptime: (Date.now() - startedAt) / 1000,
      db: dbStatus,
      breakers,
    },
    httpStatus,
  );
});
