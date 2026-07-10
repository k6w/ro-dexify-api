import { describe, expect, it } from 'vitest';
import { transcribe } from '../../src/phonetics/index.js';
import { fixture } from '../helpers.js';

const ipa = (w: string, stressMark?: string) => transcribe(w, stressMark ? { stressMark } : {}).ipa;

/**
 * The first group is the real verification: these transcriptions were recorded
 * from ro.wiktionary independently of this code, so matching them means the
 * rules agree with a human-edited source rather than with themselves.
 */
describe('transcribe — agreement with recorded Wiktionary IPA', () => {
  it.each([
    ['casă', 'cásă', '/ˈka.sə/'],
    ['copil', undefined, '/koˈpil/'],
    ['oaie', 'oáie', '/ˈo̯a.je/'],
    ['merge', 'mérge', '/ˈmer.d͡ʒe/'],
  ])('%s -> %s', (word, stressMark, want) => {
    expect(ipa(word, stressMark)).toBe(want);
  });

  it('the corpus it is checked against is really in the fixtures', () => {
    const wikitext = JSON.parse(fixture('wiktionary', 'casă')).parse.wikitext as string;
    expect(wikitext).toContain("{{AFI|/'ka.sə/}}");
  });
});

describe('transcribe — the rules that decide correctness', () => {
  it('softens c and g before e and i', () => {
    expect(ipa('ceas')).toBe('/t͡ʃas/');
    expect(ipa('cinci')).toContain('t͡ʃ');
    expect(ipa('ger')).toContain('d͡ʒ');
  });

  it('treats ch and gh as plain k and ɡ, never sounding the h', () => {
    expect(ipa('ghiozdan')).toBe('/ɡjozˈdan/');
    expect(ipa('chema')).toContain('k');
    expect(ipa('chema')).not.toContain('h');
  });

  it('drops the softening i when another vowel follows', () => {
    // "ceas" is t͡ʃas, not t͡ʃeas; the e only softens the c.
    expect(ipa('ceas')).not.toContain('e');
  });

  it('reads ea and oa as rising diphthongs', () => {
    expect(ipa('floare')).toBe('/ˈflo̯a.re/');
    expect(ipa('seara')).toContain('e̯a');
  });

  it('reads a close vowel after a nucleus as a falling glide', () => {
    // Regression: these came out /ˈo̯u/ and /ˈlu̯i/ when every vowel-before-vowel
    // was treated as a rising diphthong.
    expect(ipa('ou')).toBe('/ow/');
    expect(ipa('lui')).toBe('/luj/');
    expect(ipa('tablou')).toBe('/taˈblow/');
  });

  it('keeps identical adjacent vowels in hiatus', () => {
    // "știință" is ști-in-ță, three syllables, not ștjin-ță.
    expect(ipa('știință')).toBe('/ʃtiˈin.t͡sə/');
  });

  it('palatalises a word-final i after a consonant', () => {
    expect(ipa('lupi')).toBe('/lupʲ/');
    expect(ipa('pomi')).toBe('/pomʲ/');
  });

  it('renders ș and ț', () => {
    expect(ipa('și')).toContain('ʃ');
    expect(ipa('țară')).toContain('t͡s');
  });

  it('omits the stress mark on monosyllables', () => {
    for (const w of ['ou', 'lui', 'ceas']) expect(ipa(w)).not.toContain('ˈ');
  });
});

describe('transcribe — stress', () => {
  it('uses the dictionary mark when there is one', () => {
    const t = transcribe('casă', { stressMark: 'cásă' });
    expect(t.stressOrigin).toBe('attested');
    expect(t.confidence).toBe('high');
  });

  it('marks a guessed stress as derived and low confidence', () => {
    const t = transcribe('copil');
    expect(t.stressOrigin).toBe('derived');
    expect(t.confidence).toBe('low');
  });

  it('maps the mark by character, not by vowel ordinal', () => {
    // In "oaie" the letter o is the second vowel but the glide /o̯/, so a vowel
    // ordinal put the stress on the wrong syllable.
    expect(transcribe('oaie', { stressMark: 'oáie' }).stressedSyllable).toBe(0);
  });
});

describe('transcribe — syllabification', () => {
  it.each([
    ['casă', 'ca-să'],
    ['copil', 'co-pil'],
    ['floare', 'floa-re'],
    ['iubire', 'iu-bi-re'],
    ['știință', 'ști-in-ță'],
  ])('%s -> %s', (word, want) => {
    expect(transcribe(word).syllabification).toBe(want);
  });

  it('keeps a stop+liquid cluster together (muta cum liquida)', () => {
    expect(transcribe('tablou').syllabification).toBe('ta-blou');
  });

  it('does not split a monosyllable', () => {
    expect(transcribe('ceas').syllabification).toBe('ceas');
  });
});

describe('transcribe — degenerate input', () => {
  it('handles an empty string', () => {
    expect(() => transcribe('')).not.toThrow();
  });

  it('transcribes each part of a hyphenated compound', () => {
    const t = transcribe('gândac-de-casă');
    expect(t.ipa).toContain('ɡɨn');
    expect(t.ipa).toContain('ka.sə');
  });
});
