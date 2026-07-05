import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { getLogger } from '../../src/lib/logger.js';

const app = buildApp({ logger: getLogger() });

async function spec(): Promise<{ paths: Record<string, unknown> }> {
  const res = await app.request('/openapi.json');
  return (await res.json()) as { paths: Record<string, unknown> };
}

describe('GET /openapi.json', () => {
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
