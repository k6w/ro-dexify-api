import robotsParser from 'robots-parser';
import type { Logger } from '../lib/logger.js';
import { fetchText } from './client.js';

interface CacheEntry {
  parser: ReturnType<typeof robotsParser>;
  fetchedAt: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

export async function isAllowed(url: string, userAgent: string, logger?: Logger): Promise<boolean> {
  const u = new URL(url);
  const origin = u.origin;
  const cached = cache.get(origin);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.parser.isAllowed(url, userAgent) ?? true;
  }
  try {
    const robotsUrl = `${origin}/robots.txt`;
    const res = await fetchText({
      url: robotsUrl,
      headers: { 'user-agent': userAgent },
      retries: 0,
      ...(logger ? { logger } : {}),
    });
    const body = res.status >= 200 && res.status < 300 ? res.body : '';
    const parser = robotsParser(robotsUrl, body);
    cache.set(origin, { parser, fetchedAt: now });
    return parser.isAllowed(url, userAgent) ?? true;
  } catch (e) {
    logger?.warn({ origin, err: String(e) }, 'robots_fetch_failed');
    const parser = robotsParser(`${origin}/robots.txt`, '');
    cache.set(origin, { parser, fetchedAt: now });
    return true;
  }
}

export function crawlDelayMs(url: string, userAgent: string): number | undefined {
  const u = new URL(url);
  const cached = cache.get(u.origin);
  if (!cached) return undefined;
  const seconds = cached.parser.getCrawlDelay(userAgent);
  return typeof seconds === 'number' ? seconds * 1000 : undefined;
}

export function clearRobotsCacheForTests(): void {
  cache.clear();
}
