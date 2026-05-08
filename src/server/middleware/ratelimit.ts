import type { MiddlewareHandler } from 'hono';
import { LRUCache } from 'lru-cache';
import { ApiException } from '../../schema/errors.js';

interface Bucket {
  tokens: number;
  updatedAt: number;
}

export const rateLimitMiddleware = (perMinute: number): MiddlewareHandler => {
  const buckets = new LRUCache<string, Bucket>({ max: 5000, ttl: 5 * 60 * 1000 });
  const refillPerMs = perMinute / 60_000;
  return async (c, next) => {
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      c.req.header('cf-connecting-ip') ??
      'unknown';
    const now = Date.now();
    const b = buckets.get(ip) ?? { tokens: perMinute, updatedAt: now };
    const elapsed = now - b.updatedAt;
    b.tokens = Math.min(perMinute, b.tokens + elapsed * refillPerMs);
    b.updatedAt = now;
    if (b.tokens < 1) {
      buckets.set(ip, b);
      const retryAfter = Math.ceil((1 - b.tokens) / refillPerMs / 1000);
      c.res.headers.set('retry-after', String(retryAfter));
      throw new ApiException('RATE_LIMITED', 'too many requests');
    }
    b.tokens -= 1;
    buckets.set(ip, b);
    await next();
  };
};
