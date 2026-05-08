import PQueue from 'p-queue';

const queues = new Map<string, PQueue>();

export interface HostLimit {
  minIntervalMs: number;
  concurrency: number;
}

export function getHostQueue(host: string, limit: HostLimit): PQueue {
  let q = queues.get(host);
  if (!q) {
    q = new PQueue({
      concurrency: limit.concurrency,
      interval: limit.minIntervalMs,
      intervalCap: 1,
    });
    queues.set(host, q);
  }
  return q;
}

export function runOnHost<T>(host: string, limit: HostLimit, task: () => Promise<T>): Promise<T> {
  const q = getHostQueue(host, limit);
  return q.add(task, { throwOnTimeout: true }) as Promise<T>;
}
