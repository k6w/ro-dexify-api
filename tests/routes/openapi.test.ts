import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { getLogger } from '../../src/lib/logger.js';

const app = buildApp({ logger: getLogger() });

async function spec(): Promise<{ paths: Record<string, unknown>; tags?: unknown[] }> {
  const res = await app.request('/openapi.json');
  return (await res.json()) as { paths: Record<string, unknown>; tags?: unknown[] };
}
const spec_ = spec;

describe('GET /openapi.json', () => {
  it('groups operations into named sections', async () => {
    // Without tags, Scalar renders one flat list of eleven operations with no
    // grouping, which is what made /docs unreadable.
    const spec = (await spec_()) as unknown as { tags?: Array<{ name: string }> };
    expect(spec.tags?.length ?? 0).toBeGreaterThanOrEqual(4);
  });

  it('gives every operation a section, an id and a summary', async () => {
    const paths = (await spec()).paths as Record<string, Record<string, Record<string, unknown>>>;
    for (const [path, ops] of Object.entries(paths)) {
      for (const [method, op] of Object.entries(ops)) {
        expect(op.tags, `${method} ${path} has no tag`).toBeTruthy();
        expect(op.operationId, `${method} ${path} has no operationId`).toBeTruthy();
        expect(op.summary, `${method} ${path} has no summary`).toBeTruthy();
      }
    }
  });

  it('names every operation distinguishably', async () => {
    // Four of these are variations on "look up a word"; identical summaries
    // make the sidebar impossible to read.
    const paths = (await spec()).paths as Record<string, Record<string, { summary: string }>>;
    const summaries = Object.values(paths).flatMap((ops) =>
      Object.values(ops).map((o) => o.summary),
    );
    expect(new Set(summaries).size).toBe(summaries.length);
  });

  it('documents both API versions of /word', async () => {
    const paths = Object.keys((await spec()).paths);
    for (const p of [
      '/v1/word/{word}',
      '/v2/word/{word}',
      '/v1/word/{word}/{source}',
      '/v2/word/{word}/{source}',
    ]) {
      expect(paths).toContain(p);
    }
  });

  it('documents every view query parameter', async () => {
    const path = (await spec()).paths['/v2/word/{word}'] as {
      get: { parameters: Array<{ name: string }> };
    };
    const names = path.get.parameters.map((p) => p.name);
    for (const q of [
      'sources',
      'refresh',
      'include',
      'all',
      'dict',
      'limit',
      'orthographic',
      'merge',
    ]) {
      expect(names, `parameter ${q} should be documented`).toContain(q);
    }
  });

  it('documents every non-word route the app mounts', async () => {
    const paths = Object.keys((await spec()).paths);
    for (const p of [
      '/v1/search',
      '/v1/conjugate/{verb}',
      '/v1/pluralize/{noun}',
      '/v1/sources',
      '/v1/healthz',
    ]) {
      expect(paths).toContain(p);
    }
  });
});
