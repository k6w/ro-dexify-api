import { createHash } from 'node:crypto';
import { ulid } from 'ulid';

export function newUlid(): string {
  return ulid();
}

export function deterministicId(parts: readonly (string | number)[]): string {
  const hash = createHash('sha256').update(parts.join('')).digest('hex');
  return hash.slice(0, 26);
}
