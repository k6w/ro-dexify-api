import { createWriteStream } from 'node:fs';
import { mkdir, stat, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { request } from 'undici';
import type { Logger } from '../lib/logger.js';

export interface DownloadOptions {
  url: string;
  destination: string;
  resume?: boolean;
  logger?: Logger;
  signal?: AbortSignal;
}

export interface DownloadResult {
  path: string;
  bytes: number;
  cached: boolean;
}

export async function downloadDump(opts: DownloadOptions): Promise<DownloadResult> {
  const dest = resolve(opts.destination);
  await mkdir(dirname(dest), { recursive: true });
  let existing = 0;
  try {
    const s = await stat(dest);
    existing = s.size;
  } catch {}

  const headers: Record<string, string> = {
    'user-agent': 'ro-dexify-api/2.0 (seed)',
  };
  if (opts.resume && existing > 0) {
    headers.range = `bytes=${existing}-`;
  }

  const res = await request(opts.url, {
    method: 'GET',
    headers,
    ...(opts.signal ? { signal: opts.signal } : {}),
  });

  if (res.statusCode === 416 && existing > 0) {
    return { path: dest, bytes: existing, cached: true };
  }
  if (res.statusCode === 304) {
    return { path: dest, bytes: existing, cached: true };
  }
  if (res.statusCode >= 400) {
    throw new Error(`download failed: HTTP ${res.statusCode}`);
  }

  const append = res.statusCode === 206;
  if (!append && existing > 0) await unlink(dest).catch(() => undefined);

  return await new Promise<DownloadResult>((resolveP, reject) => {
    const out = createWriteStream(dest, { flags: append ? 'a' : 'w' });
    let bytes = append ? existing : 0;
    res.body.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
    });
    res.body.pipe(out);
    out.on('finish', () => {
      opts.logger?.info({ bytes, dest }, 'dump_downloaded');
      resolveP({ path: dest, bytes, cached: false });
    });
    out.on('error', reject);
    res.body.on('error', reject);
  });
}
