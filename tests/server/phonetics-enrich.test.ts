import { describe, expect, it } from 'vitest';
import type { EntryV2 } from '../../src/schema/entry-v2.js';
import { withDerivedPronunciation } from '../../src/server/phonetics-enrich.js';

function entry(init: Partial<EntryV2> = {}): EntryV2 {
  return {
    id: 'e1',
    headword: 'casă',
    displayHeadword: 'casă',
    partOfSpeech: 'substantiv',
    inflections: [],
    pronunciations: [],
    senses: [],
    derived: [],
    compounds: [],
    ...init,
    source: {
      providerId: 'doom',
      providerName: 'DOOM 3',
      authority: 98,
      url: 'https://doom.lingv.ro/cautare/q/casa',
      license: 'x',
      attribution: 'x',
      fetchedAt: new Date().toISOString(),
      cacheHit: false,
    },
  };
}

describe('withDerivedPronunciation', () => {
  it('adds IPA to an entry that has none', () => {
    const out = withDerivedPronunciation(entry());
    expect(out.pronunciations[0]?.ipa).toBe('/ˈka.sə/');
    expect(out.pronunciations[0]?.syllabification).toBe('ca-să');
  });

  it('never overwrites an attested transcription', () => {
    const out = withDerivedPronunciation(entry({ pronunciations: [{ ipa: '/ˈka.zə/' }] }));
    expect(out.pronunciations).toHaveLength(1);
    expect(out.pronunciations[0]?.ipa).toBe('/ˈka.zə/');
  });

  it("uses a dictionary's stress mark instead of guessing", () => {
    // "casă" would take penultimate stress by rule anyway; "copil" would not.
    const out = withDerivedPronunciation(
      entry({ displayHeadword: 'copil', pronunciations: [{ stressMark: 'copíl' }] }),
    );
    expect(out.pronunciations[0]?.ipa).toBe('/koˈpil/');
  });

  it('merges into the existing pronunciation rather than duplicating it', () => {
    const out = withDerivedPronunciation(entry({ pronunciations: [{ stressMark: 'cásă' }] }));
    expect(out.pronunciations).toHaveLength(1);
    expect(out.pronunciations[0]?.stressMark).toBe('cásă');
    expect(out.pronunciations[0]?.ipa).toBe('/ˈka.sə/');
  });

  it('leaves an entry alone when transcription yields nothing', () => {
    const out = withDerivedPronunciation(entry({ displayHeadword: '—' }));
    expect(out.pronunciations).toEqual([]);
  });
});
