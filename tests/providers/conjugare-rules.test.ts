import { describe, expect, it } from 'vitest';
import { conjugateRomanianVerb } from '../../src/providers/conjugare/rules.js';

const forms = (verb: string) => conjugateRomanianVerb(verb)?.forms ?? {};
const cls = (verb: string) => conjugateRomanianVerb(verb)?.classRoman;

describe('conjugateRomanianVerb', () => {
  describe('conjugation class', () => {
    it('puts -ea verbs in class II, not class I', () => {
      // Regression: endsWith('a') was tested before endsWith('ea'), so every
      // class II verb was misclassified and conjugated with class I endings.
      expect(cls('vedea')).toBe('II');
      expect(cls('putea')).toBe('II');
      expect(cls('avea')).toBe('II');
      expect(cls('plăcea')).toBe('II');
    });

    it('still classifies the other classes correctly', () => {
      expect(cls('cânta')).toBe('I');
      expect(cls('merge')).toBe('III');
      expect(cls('citi')).toBe('IV');
      expect(cls('coborî')).toBe('IV');
    });
  });

  describe('the infinitive particle', () => {
    it('accepts "a fi" as the infinitive of fi', () => {
      // Regression: "a fi" was treated as a stem, producing "a fesc"/"a fit".
      expect(forms('a fi')['ind.prez.1sg']).toBe('sunt');
      expect(forms('a fi')['part.past']).toBe('fost');
    });

    it('gives the same result with or without the particle', () => {
      expect(forms('a merge')).toEqual(forms('merge'));
      expect(forms('a cânta')).toEqual(forms('cânta'));
    });
  });

  describe('irregular verbs', () => {
    it('conjugates fi', () => {
      const f = forms('fi');
      expect(f['ind.prez.1sg']).toBe('sunt');
      expect(f['ind.prez.2sg']).toBe('ești');
      expect(f['ind.prez.3sg']).toBe('este');
      expect(f['ind.prez.3pl']).toBe('sunt');
      expect(f['part.past']).toBe('fost');
    });

    it('conjugates avea', () => {
      const f = forms('avea');
      expect(f['ind.prez.1sg']).toBe('am');
      expect(f['ind.prez.3sg']).toBe('are');
      expect(f['part.past']).toBe('avut');
    });

    it('conjugates merge with its real participle', () => {
      // Regression: the rule engine derived "mergut" and imperative "merge".
      const f = forms('merge');
      expect(f['part.past']).toBe('mers');
      expect(f['imperative.2sg']).toBe('mergi');
      expect(f['ind.prez.1sg']).toBe('merg');
    });

    it('conjugates face', () => {
      // Regression: derived "facut" (missing the a -> ă alternation) and "face".
      const f = forms('face');
      expect(f['part.past']).toBe('făcut');
      expect(f['imperative.2sg']).toBe('fă');
    });

    it('conjugates vedea', () => {
      // Regression: "vedeat" / "vedeă" from the class I misclassification.
      const f = forms('vedea');
      expect(f['part.past']).toBe('văzut');
      expect(f['ind.prez.1sg']).toBe('văd');
    });
  });

  describe('regular verbs still work', () => {
    it('conjugates citi (class IV, -esc)', () => {
      const f = forms('citi');
      expect(f['ind.prez.1sg']).toBe('citesc');
      expect(f['ind.prez.2sg']).toBe('citești');
      expect(f['part.past']).toBe('citit');
    });

    it('conjugates cânta (class I)', () => {
      const f = forms('cânta');
      expect(f['ind.prez.1sg']).toBe('cânt');
      expect(f['ind.prez.3sg']).toBe('cântă');
      expect(f['part.past']).toBe('cântat');
    });
  });

  describe('degenerate input', () => {
    it('returns undefined for a non-verb ending', () => {
      expect(conjugateRomanianVerb('casă')).toBeUndefined();
    });

    it('returns undefined for empty or too-short input', () => {
      expect(conjugateRomanianVerb('')).toBeUndefined();
      expect(conjugateRomanianVerb('a')).toBeUndefined();
    });
  });
});
