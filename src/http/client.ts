import { Agent, type Dispatcher, getGlobalDispatcher, request } from 'undici';
import type { Logger } from '../lib/logger.js';

const defaultAgent = new Agent({
  connectTimeout: 5_000,
  bodyTimeout: 15_000,
  headersTimeout: 10_000,
  keepAliveTimeout: 30_000,
  pipelining: 1,
});

function activeDispatcher(): Dispatcher {
  const global = getGlobalDispatcher();
  return global !== defaultAgent ? global : defaultAgent;
}

export interface FetchOptions {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  signal?: AbortSignal;
  retries?: number;
  retryBaseMs?: number;
  logger?: Logger;
}

export interface FetchResponse {
  status: number;
  body: string;
  etag?: string;
  lastModified?: string;
  contentType?: string;
}

export async function fetchText(opts: FetchOptions): Promise<FetchResponse> {
  const retries = opts.retries ?? 2;
  const baseMs = opts.retryBaseMs ?? 200;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const jitter = 0.5 + Math.random();
      const wait = Math.round(baseMs * 2 ** (attempt - 1) * jitter);
      await sleep(wait, opts.signal);
    }
    try {
      const res = await request(opts.url, {
        method: opts.method ?? 'GET',
        ...(opts.headers ? { headers: opts.headers } : {}),
        ...(opts.signal ? { signal: opts.signal } : {}),
        dispatcher: activeDispatcher(),
      });
      const status = res.statusCode;
      const body = await res.body.text();
      const etag = headerString(res.headers.etag);
      const lastModified = headerString(res.headers['last-modified']);
      const contentType = headerString(res.headers['content-type']);

      if (status >= 500 && attempt < retries) {
        opts.logger?.debug({ url: opts.url, status, attempt }, 'http_retry');
        continue;
      }
      return {
        status,
        body,
        ...(etag !== undefined ? { etag } : {}),
        ...(lastModified !== undefined ? { lastModified } : {}),
        ...(contentType !== undefined ? { contentType } : {}),
      };
    } catch (e) {
      lastErr = e;
      if (attempt >= retries) break;
      opts.logger?.debug({ url: opts.url, err: String(e), attempt }, 'http_error_retry');
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

function headerString(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('aborted'));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(new Error('aborted'));
      },
      { once: true },
    );
  });
}
