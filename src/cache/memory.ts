import { LRUCache } from 'lru-cache';
import type { EntryV2 } from '../schema/entry-v2.js';

interface MemEntry {
  entries: EntryV2[];
  expiresAt: number;
}

const cache = new LRUCache<string, MemEntry>({
  max: 5000,
  maxSize: 32 * 1024 * 1024,
  sizeCalculation: (v) => Buffer.byteLength(JSON.stringify(v)),
  ttl: 5 * 60 * 1000,
});

function key(providerId: string, headword: string): string {
  return `${providerId}:${headword}`;
}

export function getMem(providerId: string, headword: string): EntryV2[] | undefined {
  const v = cache.get(key(providerId, headword));
  if (!v) return undefined;
  if (v.expiresAt < Date.now()) {
    cache.delete(key(providerId, headword));
    return undefined;
  }
  return v.entries;
}

export function setMem(
  providerId: string,
  headword: string,
  entries: EntryV2[],
  ttlMs: number,
): void {
  cache.set(key(providerId, headword), { entries, expiresAt: Date.now() + ttlMs });
}

export function clearMem(): void {
  cache.clear();
}
