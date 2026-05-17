import { Hono } from 'hono';
import { getBreakerState } from '../../http/breaker.js';
import { listProviders } from '../../providers/registry.js';
import type { ProviderId } from '../../schema/entry.js';

export const sourcesRoutes = new Hono();

sourcesRoutes.get('/sources', (c) => {
  const sources = listProviders().map((p) => ({
    id: p.meta.id,
    name: p.meta.name,
    homepage: p.meta.homepage,
    license: p.meta.license,
    attribution: p.meta.attribution,
    capabilities: Array.from(p.meta.capabilities),
    ttlSeconds: p.meta.ttlSeconds,
    enabled: p.meta.enabled,
    breakerState: getBreakerState(p.meta.id as ProviderId),
    rateLimitMs: p.meta.rateLimit.minIntervalMs,
  }));
  return c.json({ sources });
});
