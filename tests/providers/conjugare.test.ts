import { describe, expect, it } from 'vitest';
import { conjugateRomanianVerb } from '../../src/providers/conjugare/rules.js';

describe('conjugateRomanianVerb', () => {
  it('class IV verb (-i): a citi', () => {
    const r = conjugateRomanianVerb('citi');
    expect(r?.classRoman).toBe('IV');
    expect(r?.forms['ind.prez.1sg']).toBe('citesc');
    expect(r?.forms['ind.prez.3sg']).toBe('citește');
    expect(r?.forms['part.past']).toBe('citit');
    expect(r?.forms.gerund).toBe('citind');
  });

  it('class I verb (-a): a cânta', () => {
    const r = conjugateRomanianVerb('cânta');
    expect(r?.classRoman).toBe('I');
    expect(r?.forms['ind.prez.1sg']).toBe('cânt');
    expect(r?.forms['part.past']).toBe('cântat');
  });

  it('class III verb (-e): a merge', () => {
    const r = conjugateRomanianVerb('merge');
    expect(r?.classRoman).toBe('III');
    expect(r?.forms['ind.prez.1sg']).toBe('merg');
  });

  it('returns undefined for unrecognised endings', () => {
    expect(conjugateRomanianVerb('')).toBeUndefined();
    expect(conjugateRomanianVerb('xx')).toBeUndefined();
  });
});
