import { describe, expect, it } from 'vitest';
import { listProviders } from '../../src/providers/registry.js';

describe('robotsPolicy', () => {
  it('exempts only ro.wiktionary from the robots.txt check', () => {
    const exempt = listProviders()
      .filter((p) => p.meta.robotsPolicy === 'official-api')
      .map((p) => p.meta.id);
    expect(exempt).toEqual(['wiktionary']);
  });

  it('leaves every page-scraping provider on the default crawler policy', () => {
    for (const id of ['doom', 'dexonline', 'mdex', 'dlr']) {
      const p = listProviders().find((x) => x.meta.id === id);
      if (!p) continue;
      expect(p.meta.robotsPolicy ?? 'crawler').toBe('crawler');
    }
  });

  it('keeps a rate limit on the exempt provider', () => {
    const w = listProviders().find((p) => p.meta.id === 'wiktionary');
    expect(w?.meta.rateLimit.minIntervalMs).toBeGreaterThan(0);
  });
});
