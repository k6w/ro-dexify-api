import { describe, expect, it } from 'vitest';
import { asciiFold, isValidHeadword, normalizeHeadword } from '../../src/lib/headword.js';

describe('headword utils', () => {
  it('normalizes case and unicode', () => {
    expect(normalizeHeadword('CASĂ')).toBe('casă');
  });

  it('asciiFold strips diacritics including ț/ș', () => {
    expect(asciiFold('țară')).toBe('tara');
    expect(asciiFold('ștefan')).toBe('stefan');
  });

  it('isValidHeadword rejects digits and symbols', () => {
    expect(isValidHeadword('casă')).toBe(true);
    expect(isValidHeadword('a-doua')).toBe(true);
    expect(isValidHeadword('drop table users')).toBe(true);
    expect(isValidHeadword('<script>')).toBe(false);
    expect(isValidHeadword('123')).toBe(false);
    expect(isValidHeadword('')).toBe(false);
  });
});
