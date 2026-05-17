import { ConsecutiveBreaker, circuitBreaker, handleAll } from 'cockatiel';
import type { ProviderId } from '../schema/entry.js';

export type BreakerState = 'closed' | 'half-open' | 'open';

const breakers = new Map<ProviderId, ReturnType<typeof circuitBreaker>>();

export function getBreaker(providerId: ProviderId) {
  let b = breakers.get(providerId);
  if (!b) {
    b = circuitBreaker(handleAll, {
      halfOpenAfter: 60_000,
      breaker: new ConsecutiveBreaker(5),
    });
    breakers.set(providerId, b);
  }
  return b;
}

export function getBreakerState(providerId: ProviderId): BreakerState {
  const b = breakers.get(providerId);
  if (!b) return 'closed';
  const s = b.state;
  if (s === 0) return 'closed';
  if (s === 1) return 'open';
  return 'half-open';
}

export function allBreakerStates(): Record<string, BreakerState> {
  const out: Record<string, BreakerState> = {};
  for (const id of breakers.keys()) {
    out[id] = getBreakerState(id);
  }
  return out;
}
