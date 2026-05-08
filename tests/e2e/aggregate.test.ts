import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher, type Dispatcher } from 'undici';
import { buildApp } from '../../src/app.js';
import { getLogger } from '../../src/lib/logger.js';
import { clearRobotsCacheForTests } from '../../src/http/robots.js';
import { clearMem } from '../../src/cache/memory.js';

let mock: MockAgent;
let original: Dispatcher;

describe('aggregator failure isolation', () => {
  beforeEach(() => {
    original = getGlobalDispatcher();
    mock = new MockAgent();
    mock.disableNetConnect();
    setGlobalDispatcher(mock);
    clearMem();
    clearRobotsCacheForTests();
    for (const host of [
      'https://doom.lingv.ro',
      'https://dexonline.ro',
      'https://m.dex.ro',
      'https://ro.wiktionary.org',
    ]) {
      mock.get(host).intercept({ path: '/robots.txt', method: 'GET' }).reply(200, '').persist();
    }
  });

  afterEach(async () => {
    setGlobalDispatcher(original);
    await mock.close();
  });

  it('returns DOOM data even when DEXonline returns 500', async () => {
    const doomBody = readFileSync(resolve('tests/fixtures/doom/casa.html'), 'utf8');
    mock
      .get('https://doom.lingv.ro')
      .intercept({ path: /\/cautare\/q\/.*/, method: 'GET' })
      .reply(200, doomBody)
      .persist();
    mock
      .get('https://dexonline.ro')
      .intercept({ path: /\/definitie\/.*/, method: 'GET' })
      .reply(500, 'oops')
      .persist();

    const app = buildApp({ logger: getLogger() });
    const res = await app.request('/v1/word/cas%C4%83?sources=doom,dexonline');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      entries: { source: { providerId: string } }[];
      errors: { providerId: string; code: string }[];
    };
    expect(body.entries.some((e) => e.source.providerId === 'doom')).toBe(true);
    expect(body.errors.some((e) => e.providerId === 'dexonline')).toBe(true);
  }, 20_000);
});
