import { describe, expect, it } from 'vitest';
import { type EntryV2, senseNode } from '../../src/schema/entry-v2.js';
import { applyView } from '../../src/server/view.js';

function entry(sourceName: string, authority: number, senseTexts: string[]): EntryV2 {
  return {
    id: `${sourceName}-${authority}`,
    headword: 'casă',
    displayHeadword: 'casă',
    partOfSpeech: 'substantiv',
    inflections: [],
    pronunciations: [],
    senses: senseTexts.map((t, i) => senseNode(t, { number: i + 1 })),
    derived: [],
    compounds: [],
    source: {
      providerId: 'dexonline',
      providerName: 'DEXonline',
      sourceName,
      authority,
      url: 'https://dexonline.ro/definitie/cas%C4%83',
      license: 'GPL-2.0-or-later',
      attribution: 'DEXonline.ro',
      fetchedAt: new Date().toISOString(),
      cacheHit: false,
    },
  };
}

const CORPUS = [
  entry('Șăineanu, ed. VI', 12, ['Locuinta veche de la tara, cu pridvor.']),
  entry("DEX '09", 95, ['Clădire care servește drept locuință.']),
  entry('DOOM 3', 98, ['s. f., g.-d. art. casei; pl. case']),
  entry('MDA2', 90, ['Constructie destinata pentru a servi drept adapost.']),
];

describe('applyView', () => {
  it('ranks by authority, highest first', () => {
    const names = applyView(CORPUS).map((e) => e.source.sourceName);
    expect(names[0]).toBe("DEX '09");
    expect(names.indexOf("DEX '09")).toBeLessThan(names.indexOf('Șăineanu, ed. VI'));
  });

  it('drops orthographic-only sources by default', () => {
    expect(applyView(CORPUS).map((e) => e.source.sourceName)).not.toContain('DOOM 3');
  });

  it('keeps them when asked', () => {
    const names = applyView(CORPUS, { includeOrthographic: true, all: true }).map(
      (e) => e.source.sourceName,
    );
    expect(names).toContain('DOOM 3');
    expect(names[0]).toBe('DOOM 3');
  });

  it('never filters a provider down to nothing', () => {
    // The doom provider's own entries are orthographic by nature.
    const onlyDoom = [entry('DOOM 3', 98, ['s. f., pl. case'])];
    expect(applyView(onlyDoom)).toHaveLength(1);
  });

  it('filters by dictionary', () => {
    const out = applyView(CORPUS, { dictionaries: ["dex '09"] });
    expect(out).toHaveLength(1);
    expect(out[0]?.source.sourceName).toBe("DEX '09");
  });

  it('caps the result and honours an explicit limit', () => {
    expect(applyView(CORPUS, { limit: 1 })).toHaveLength(1);
  });

  it('skips ranking and the cap for all: true', () => {
    expect(applyView(CORPUS, { all: true, includeOrthographic: true })).toHaveLength(4);
  });

  it('collapses entries whose senses are already covered', () => {
    const dup = entry('DLRLC', 60, ['Clădire care servește drept locuință.']);
    const out = applyView([...CORPUS, dup]);
    expect(out.map((e) => e.source.sourceName)).not.toContain('DLRLC');
  });

  it('is a pure function of its input', () => {
    const before = CORPUS.map((e) => e.source.sourceName);
    applyView(CORPUS, { limit: 1 });
    expect(CORPUS.map((e) => e.source.sourceName)).toEqual(before);
  });
});
