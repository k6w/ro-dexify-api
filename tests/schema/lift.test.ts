import { describe, expect, it } from 'vitest';
import { liftEntry } from '../../src/schema/adapters/lift.js';
import { entryToV1 } from '../../src/schema/adapters/v1.js';
import { EntryV2 } from '../../src/schema/entry-v2.js';
import type { NormalizedEntry } from '../../src/schema/entry.js';

const v1: NormalizedEntry = {
  id: 'e1',
  headword: 'casă',
  displayHeadword: 'casă',
  partOfSpeech: 'substantiv',
  gender: 'feminin',
  inflections: [{ form: 'case', tags: ['plural'] }],
  pronunciations: [{ stressMark: 'cásă' }],
  senses: [
    {
      number: 1,
      text: 'Clădire.',
      register: ['regional'],
      examples: [{ text: 'O casă mare.', citation: 'STANCU' }],
      synonyms: ['locuință'],
      antonyms: [],
    },
  ],
  etymology: { text: 'Lat. casa.', languages: ['lat.'] },
  source: {
    providerId: 'dexonline',
    providerName: 'DEXonline',
    workTitle: "DEX '09",
    url: 'https://dexonline.ro/definitie/cas%C4%83',
    license: 'GPL-2.0-or-later',
    attribution: 'DEXonline.ro',
    fetchedAt: new Date().toISOString(),
    cacheHit: false,
  },
};

describe('liftEntry', () => {
  it('produces a valid v2 entry', () => {
    expect(() => EntryV2.parse(liftEntry(v1))).not.toThrow();
  });

  it('turns v1 examples into example child nodes, keeping citations', () => {
    const child = liftEntry(v1).senses[0]?.children[0];
    expect(child?.type).toBe('example');
    expect(child?.citation).toBe('STANCU');
  });

  it('moves synonyms onto the node relations', () => {
    expect(liftEntry(v1).senses[0]?.relations.synonyms).toEqual(['locuință']);
  });

  it('marks rule-derived forms so they are distinguishable from attested ones', () => {
    const lifted = liftEntry(v1, { origin: 'derived', confidence: 'low' });
    expect(lifted.inflections[0]?.origin).toBe('derived');
    expect(lifted.inflections[0]?.confidence).toBe('low');
  });

  it('round-trips back to the original v1 entry', () => {
    // lift then flatten must be the identity for a flat entry, or /v1 responses
    // would change shape when providers moved to v2.
    expect(entryToV1(liftEntry(v1))).toEqual(v1);
  });
});

describe('liftEntry — homonym index', () => {
  it('carries an index a v1-shaped provider parsed', () => {
    // v1 has no field for it, but m.dex.ro fuses it onto the headword and
    // parses it out; dropping it here would lose it before /v2.
    const lifted = liftEntry({ ...v1, homonymIndex: 2 });
    expect(lifted.homonymIndex).toBe(2);
  });

  it('omits it when there is none', () => {
    expect(liftEntry(v1).homonymIndex).toBeUndefined();
  });
});
