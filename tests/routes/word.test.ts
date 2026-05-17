import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type Dispatcher, MockAgent, getGlobalDispatcher, setGlobalDispatcher } from 'undici';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { clearMem } from '../../src/cache/memory.js';
import { clearRobotsCacheForTests } from '../../src/http/robots.js';
import { getLogger } from '../../src/lib/logger.js';

let mock: MockAgent;
let original: Dispatcher;

describe('GET /v1/word/:word', () => {
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

  it('returns DOOM with empty senses (no fake "Verb: a X")', async () => {
    const doomFixture = readFileSync(resolve('tests/fixtures/doom/casa.html'), 'utf8');
    mock
      .get('https://doom.lingv.ro')
      .intercept({ path: /\/cautare\/q\/.*/, method: 'GET' })
      .reply(200, doomFixture)
      .persist();

    const app = buildApp({ logger: getLogger() });
    const res = await app.request('/v1/word/cas%C4%83?sources=doom');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      entries: Array<{ source: { providerId: string }; senses: unknown[]; partOfSpeech: string }>;
      errors: unknown[];
    };
    expect(body.entries.length).toBeGreaterThan(0);
    for (const e of body.entries) {
      if (e.source.providerId === 'doom') {
        expect(e.senses).toEqual([]);
      }
    }
    expect(JSON.stringify(body)).not.toMatch(/Verb:\s+a\s+/);
  });

  it('rejects invalid headword', async () => {
    const app = buildApp({ logger: getLogger() });
    const res = await app.request('/v1/word/<script>');
    expect(res.status).toBe(400);
  });
});
