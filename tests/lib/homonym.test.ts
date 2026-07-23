import { describe, expect, it } from 'vitest';
import { splitHomonym } from '../../src/lib/headword.js';

describe('splitHomonym', () => {
  it('separates the index m.dex.ro fuses onto the headword', () => {
    // Regression: "CÁSĂ1," kept the digit, because stripping trailing digits
    // before the comma never matched.
    expect(splitHomonym('CÁSĂ1,')).toEqual({ lemma: 'CÁSĂ', homonymIndex: 1 });
  });

  it('handles a bare index', () => {
    expect(splitHomonym('casă1')).toEqual({ lemma: 'casă', homonymIndex: 1 });
    expect(splitHomonym('casă3')).toEqual({ lemma: 'casă', homonymIndex: 3 });
  });

  it('leaves a lemma with no index alone', () => {
    expect(splitHomonym('casă')).toEqual({ lemma: 'casă' });
    expect(splitHomonym('gândac-de-casă')).toEqual({ lemma: 'gândac-de-casă' });
  });

  it('strips trailing punctuation either side of the digit', () => {
    expect(splitHomonym('casă,')).toEqual({ lemma: 'casă' });
    expect(splitHomonym('casă1;')).toEqual({ lemma: 'casă', homonymIndex: 1 });
  });

  it('does not treat a numeral that is the word itself as an index', () => {
    expect(splitHomonym('1')).toEqual({ lemma: '1' });
  });

  it('keeps digits that belong to the lemma', () => {
    // The index must follow a letter directly; allowing any non-digit made
    // "COVID-19" come back as lemma "COVID-" with homonym index 19.
    expect(splitHomonym('COVID-19')).toEqual({ lemma: 'COVID-19' });
  });

  it('handles empty input', () => {
    expect(splitHomonym('  ')).toEqual({ lemma: '' });
  });
});
