import type { ProviderId } from '../schema/entry.js';

const DAY = 24 * 60 * 60;

export const TTL_SECONDS: Record<ProviderId, number> = {
  doom: 30 * DAY,
  dexonline: 7 * DAY,
  mdex: 7 * DAY,
  wiktionary: 3 * DAY,
  forvo: 90 * DAY,
  dlr: 60 * DAY,
  conjugare: 365 * DAY,
  pluralro: 365 * DAY,
};

export function expiresAtIso(ttlSeconds: number, now: Date = new Date()): string {
  if (!Number.isFinite(ttlSeconds)) return '9999-12-31T23:59:59.000Z';
  return new Date(now.getTime() + ttlSeconds * 1000).toISOString();
}
