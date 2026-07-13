import { describe, expect, it } from 'vitest';
import { type EntryV2, senseNode } from '../../src/schema/entry-v2.js';
import { mergeEntries } from '../../src/server/merge.js';

function entry(init: Partial<EntryV2> & { providerId: string; authority: number }): EntryV2 {
  const { providerId, authority, ...rest } = init;
  return {
    id: `${providerId}-${authority}`,
    headword: 'casă',
    displayHeadword: 'casă',
    partOfSpeech: 'substantiv',
    inflections: [],
    pronunciations: [],
    senses: [],
    derived: [],
    compounds: [],
    ...rest,
    source: {
      providerId,
      providerName: providerId,
      authority,
      url: 'https://example.org/casa',
      license: 'x',
      attribution: 'x',
      fetchedAt: new Date().toISOString(),
      cacheHit: false,
    },
  };
}

const DOOM = entry({
  providerId: 'doom',
  authority: 98,
  pronunciations: [{ stressMark: 'cásă' }],
  inflections: [
    { form: 'case', tags: ['plural'], origin: 'attested', confidence: 'high' },
    { form: 'casei', tags: ['genitive'], origin: 'attested', confidence: 'high' },
  ],
});
const DEX = entry({
  providerId: 'dexonline',
  authority: 95,
  homonymIndex: 1,
  gender: 'feminin',
  senses: [senseNode('Clădire care servește drept locuință.')],
  etymology: { text: 'Lat. casa.', languages: ['lat.'] },
});
const WIKT = entry({
  providerId: 'wiktionary',
  authority: 65,
  pronunciations: [{ ipa: '/ˈka.sə/' }],
  derived: ['acasă'],
});
const PLURAL = entry({
  providerId: 'pluralro',
  authority: 30,
  inflections: [{ form: 'case', tags: ['plural'], origin: 'derived', confidence: 'high' }],
});

describe('mergeEntries', () => {
  it('joins providers describing the same word into one entry', () => {
    const merged = mergeEntries([DOOM, DEX, WIKT, PLURAL]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.contributors).toEqual(
      expect.arrayContaining(['doom', 'dexonline', 'wiktionary', 'pluralro']),
    );
  });

  it('brings together stress, IPA, senses and etymology', () => {
    const m = mergeEntries([DOOM, DEX, WIKT, PLURAL])[0];
    expect(m?.pronunciations.find((p) => p.stressMark)?.stressMark).toBe('cásă');
    expect(m?.pronunciations.find((p) => p.ipa)?.ipa).toBe('/ˈka.sə/');
    expect(m?.senses).toHaveLength(1);
    expect(m?.etymology?.text).toBe('Lat. casa.');
    expect(m?.gender).toBe('feminin');
    expect(m?.derived).toContain('acasă');
  });

  it('lets an index-less entry join the lowest-numbered homonym', () => {
    // Only DEXonline publishes a homonym index; without this DOOM's stress
    // never reached the senses it belongs to.
    expect(mergeEntries([DOOM, DEX])).toHaveLength(1);
  });

  it('keeps genuine homonyms apart', () => {
    const second = entry({
      providerId: 'dexonline',
      authority: 95,
      homonymIndex: 2,
      senses: [senseNode('Dulap de fier în care se țin bani.')],
    });
    expect(mergeEntries([DEX, second])).toHaveLength(2);
  });

  it('prefers an attested form over a rule-derived duplicate', () => {
    const m = mergeEntries([DOOM, PLURAL])[0];
    const cases = m?.inflections.filter((i) => i.form === 'case') ?? [];
    expect(cases).toHaveLength(1);
    expect(cases[0]?.origin).toBe('attested');
  });

  it('takes a known part of speech over unknown', () => {
    const vague = entry({ providerId: 'mdex', authority: 40, partOfSpeech: 'unknown' });
    expect(mergeEntries([vague, DEX])[0]?.partOfSpeech).toBe('substantiv');
  });

  it('renumbers merged senses consecutively', () => {
    const more = entry({
      providerId: 'mdex',
      authority: 40,
      homonymIndex: 1,
      senses: [senseNode('Gospodărie; familie.')],
    });
    expect(mergeEntries([DEX, more])[0]?.senses.map((s) => s.number)).toEqual([1, 2]);
  });

  it('collapses the same transcription contributed by several providers', () => {
    // DOOM writes the stress mark "cásă" and DEXonline "CÁSĂ": different
    // objects, identical sound. Keying the dedupe on the whole object made the
    // merged entry repeat /ˈka.sə/ once per provider.
    const a = entry({
      providerId: 'doom',
      authority: 98,
      pronunciations: [{ ipa: '/ˈka.sə/', stressMark: 'cásă' }],
    });
    const b = entry({
      providerId: 'dexonline',
      authority: 95,
      homonymIndex: 1,
      pronunciations: [{ ipa: '/ˈka.sə/', stressMark: 'CÁSĂ' }],
    });
    const merged = mergeEntries([a, b])[0];
    expect(merged?.pronunciations.filter((p) => p.ipa === '/ˈka.sə/')).toHaveLength(1);
  });

  it('keeps genuinely different transcriptions', () => {
    const a = entry({ providerId: 'doom', authority: 98, pronunciations: [{ ipa: '/ˈka.sə/' }] });
    const b = entry({
      providerId: 'wiktionary',
      authority: 65,
      pronunciations: [{ ipa: '/ˈka.zə/' }],
    });
    expect(mergeEntries([a, b])[0]?.pronunciations).toHaveLength(2);
  });

  it('leaves a single entry untouched apart from contributors', () => {
    const [only] = mergeEntries([DEX]);
    expect(only?.contributors).toEqual(['dexonline']);
    expect(only?.senses).toEqual(DEX.senses);
  });
});
