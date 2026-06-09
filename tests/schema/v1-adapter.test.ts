import { describe, expect, it } from 'vitest';
import { entryToV1 } from '../../src/schema/adapters/v1.js';
import { type EntryV2, emptyRelations, senseNode } from '../../src/schema/entry-v2.js';
import { NormalizedEntry } from '../../src/schema/entry.js';

function entry(senses: EntryV2['senses']): EntryV2 {
  return {
    id: 'e1',
    headword: 'casă',
    displayHeadword: 'casă',
    partOfSpeech: 'substantiv',
    gender: 'feminin',
    inflections: [{ form: 'case', tags: ['plural'], origin: 'attested', confidence: 'high' }],
    pronunciations: [{ stressMark: 'cásă' }],
    senses,
    derived: ['acasă'],
    compounds: ['casă de bani'],
    source: {
      providerId: 'dexonline',
      providerName: 'DEXonline',
      sourceName: "DEX '09",
      authority: 95,
      url: 'https://dexonline.ro/definitie/cas%C4%83',
      license: 'GPL-2.0-or-later',
      attribution: 'DEXonline.ro',
      fetchedAt: new Date().toISOString(),
      cacheHit: false,
    },
  };
}

describe('entryToV1', () => {
  it('produces a valid v1 entry', () => {
    const v1 = entryToV1(entry([senseNode('Clădire.', { number: 1 })]));
    expect(() => NormalizedEntry.parse(v1)).not.toThrow();
  });

  it('collapses example children into the parent sense examples', () => {
    const v1 = entryToV1(
      entry([
        senseNode('Dinastie; neam.', {
          number: 7,
          children: [
            senseNode('Casa de Habsburg.', { type: 'example', citation: 'STANCU, D. 19.' }),
          ],
        }),
      ]),
    );
    expect(v1.senses).toHaveLength(1);
    expect(v1.senses[0]?.examples).toEqual([
      { text: 'Casa de Habsburg.', citation: 'STANCU, D. 19.' },
    ]);
  });

  it('collapses expressions and locutions into examples too', () => {
    const v1 = entryToV1(
      entry([
        senseNode('Clădire.', {
          children: [
            senseNode('De casă = făcut în casă.', { type: 'locution' }),
            senseNode('A avea o casă de copii.', { type: 'expression' }),
          ],
        }),
      ]),
    );
    expect(v1.senses[0]?.examples.map((e) => e.text)).toEqual([
      'De casă = făcut în casă.',
      'A avea o casă de copii.',
    ]);
  });

  it('promotes sub-meanings to top-level senses, renumbered depth-first', () => {
    const v1 = entryToV1(
      entry([
        senseNode('Clădire.', {
          number: 1,
          children: [senseNode('Cameră, odaie.', { type: 'sub-meaning' })],
        }),
        senseNode('Gospodărie.', { number: 2 }),
      ]),
    );
    expect(v1.senses.map((s) => s.text)).toEqual(['Clădire.', 'Cameră, odaie.', 'Gospodărie.']);
    expect(v1.senses.map((s) => s.number)).toEqual([1, 2, 3]);
  });

  it('maps relations onto the v1 synonym and antonym arrays', () => {
    const v1 = entryToV1(
      entry([
        senseNode('Clădire.', {
          relations: { ...emptyRelations(), synonyms: ['locuință'], antonyms: ['ruină'] },
        }),
      ]),
    );
    expect(v1.senses[0]?.synonyms).toEqual(['locuință']);
    expect(v1.senses[0]?.antonyms).toEqual(['ruină']);
  });

  it('falls back to sourceName for workTitle', () => {
    const v1 = entryToV1(entry([senseNode('Clădire.')]));
    expect(v1.source.workTitle).toBe("DEX '09");
  });

  it('drops v2-only fields rather than leaking them into v1', () => {
    const v1 = entryToV1(entry([senseNode('Clădire.')])) as Record<string, unknown>;
    for (const key of ['derived', 'compounds', 'homonymIndex', 'paradigm']) {
      expect(v1[key]).toBeUndefined();
    }
    expect((v1.source as Record<string, unknown>).authority).toBeUndefined();
  });

  it('carries the conjugation class through when a paradigm has one', () => {
    const e = entry([senseNode('A merge.')]);
    e.paradigm = { classRoman: 'III', cells: [] };
    expect(entryToV1(e).conjugation?.classRoman).toBe('III');
  });
});
