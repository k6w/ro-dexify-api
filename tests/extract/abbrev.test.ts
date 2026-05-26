import { describe, expect, it } from 'vitest';
import { isAbbreviationToken, readGrammar } from '../../src/extract/abbrev.js';

describe('readGrammar', () => {
  it('reads noun + gender from the abbreviated form', () => {
    const g = readGrammar('casă s. f., g.-d. art. casei; pl. case');
    expect(g.partOfSpeech).toBe('substantiv');
    expect(g.gender).toBe('feminin');
  });

  it('reads the same from DEXonline expanded glosses', () => {
    expect(readGrammar('substantiv feminin')).toMatchObject({
      partOfSpeech: 'substantiv',
      gender: 'feminin',
    });
    expect(readGrammar('substantiv masculin')).toMatchObject({
      partOfSpeech: 'substantiv',
      gender: 'masculin',
    });
    expect(readGrammar('substantiv neutru')).toMatchObject({
      partOfSpeech: 'substantiv',
      gender: 'neutru',
    });
  });

  it('reads verbs and their transitivity', () => {
    const g = readGrammar('merge vb., ind. prez. 3 sg. merge');
    expect(g.partOfSpeech).toBe('verb');
    expect(readGrammar('vb. tranz.').verbFlags).toContain('tranzitiv');
    expect(readGrammar('vb. refl.').verbFlags).toContain('reflexiv');
  });

  it('prefers the longer marker: loc. adj. is a locuțiune, not an adjectiv', () => {
    expect(readGrammar('loc. adj.').partOfSpeech).toBe('locuțiune');
  });

  it('does not attach gender to non-nominals', () => {
    // "f." inside an unrelated verb label must not make the verb feminine.
    expect(readGrammar('vb. intranz.').gender).toBeUndefined();
  });

  it('expands register labels to full words', () => {
    expect(readGrammar('(reg.) cameră, odaie').register).toContain('regional');
    expect(readGrammar('(înv.) ...').register).toContain('învechit');
    expect(readGrammar('(fig.) ...').register).toContain('figurat');
  });

  it('does not match a register abbreviation inside a longer word', () => {
    // "rar" must not fire on "rareori"? It is a prefix, so require a boundary
    // before it -- "brar" and "abrar" must not match.
    expect(readGrammar('abrar something').register).not.toContain('rar');
  });

  it('returns unknown for text with no grammatical marker', () => {
    const g = readGrammar('Clădire care servește drept locuință.');
    expect(g.partOfSpeech).toBe('unknown');
    expect(g.gender).toBeUndefined();
  });

  it('handles empty input', () => {
    expect(readGrammar('')).toEqual({ partOfSpeech: 'unknown', register: [], verbFlags: [] });
  });
});

describe('isAbbreviationToken', () => {
  it('rejects the fragments DOOM used to emit as headwords and forms', () => {
    for (const t of ['s.', 'art.', 'pl.', 'vb.', 'adj.', 'g.-d.', 'f.', '1']) {
      expect(isAbbreviationToken(t)).toBe(true);
    }
  });

  it('accepts real word forms', () => {
    for (const t of ['casă', 'casei', 'case', 'meargă', 'mers', 'gândac-de-casă']) {
      expect(isAbbreviationToken(t)).toBe(false);
    }
  });

  it('treats empty input as an abbreviation (nothing usable)', () => {
    expect(isAbbreviationToken('   ')).toBe(true);
  });
});
