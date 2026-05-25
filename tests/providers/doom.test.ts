import { describe, expect, it } from 'vitest';
import { parseDoom } from '../../src/providers/doom/parse.js';
import { NormalizedEntry } from '../../src/schema/entry.js';
import { firstOrThrow, fixture } from '../helpers.js';

/**
 * Golden tests against the real DOOM 3 page.
 *
 * The live page is a Bootstrap HTML document with TEI XML embedded inline, one
 * <root><entry> block per result. The recorded `casă` fixture serves four
 * entries (while reporting "9 rezultate"):
 *
 *   0  casă s. f., g.-d. art. casei; pl. case (dar: Casa Corpului Didactic,
 *      Casa Regală a României s. proprii f. art.)
 *   1  casă-muzeu s. f., g.-d. art. casei-muzeu; pl. case-muzeu
 *   2  molie-de-casă (crustaceu) (desp. -li-e-) s. f., art. molia-de-casă ...
 *   3  gândac-de-casă (insectă) s. m., pl. gândaci-de-casă
 *
 * Stress is carried by <span style="text-decoration:underline"> around the
 * stressed vowel, and syllabification by
 * <span class="doom-tooltip" title="despărțirea in silabe">.
 */
describe('DoomParser', () => {
  describe('casă', () => {
    const entries = () => parseDoom(fixture('doom', 'casă'), 'casă');

    it('returns only the exact lemma, not casă-muzeu or molie-de-casă', () => {
      const heads = entries().map((e) => e.headword);
      expect(heads).toContain('casă');
      expect(heads).not.toContain('casă-muzeu');
      expect(heads).not.toContain('molie-de-casă');
      expect(heads).not.toContain('gândac-de-casă');
    });

    it('never emits an abbreviation fragment as a headword', () => {
      // Regression: the XML object-walk produced headwords "s." and "art.".
      for (const e of entries()) {
        expect(e.displayHeadword).not.toMatch(/^(s|art|vb|adj|adv|pl|g)\.?$/i);
        expect(e.displayHeadword.length).toBeGreaterThan(1);
      }
    });

    it('reads part of speech and gender', () => {
      const e = firstOrThrow(entries(), 'entry');
      expect(e.partOfSpeech).toBe('substantiv');
      expect(e.gender).toBe('feminin');
    });

    it('extracts exactly the real inflections', () => {
      const e = firstOrThrow(entries(), 'entry');
      const forms = e.inflections.map((i) => i.form).sort();
      expect(forms).toEqual(['case', 'casei']);
      expect(e.inflections.find((i) => i.form === 'case')?.tags).toContain('plural');
      const casei = e.inflections.find((i) => i.form === 'casei');
      expect(casei?.tags).toEqual(expect.arrayContaining(['genitive', 'dative']));
    });

    it('does not turn the parenthetical proper-noun note into plural forms', () => {
      // Regression: splitting "pl. case (dar: Casa Corpului Didactic, ...)" on
      // "," emitted case, dar:, Casa, Corpului and Didactic all as plurals.
      const forms = entries().flatMap((e) => e.inflections.map((i) => i.form));
      for (const bogus of ['dar:', 'Casa', 'Corpului', 'Didactic', 'Regală', 'art.', 's.']) {
        expect(forms).not.toContain(bogus);
      }
    });

    it('records the stressed vowel that the underline markup encodes', () => {
      const e = firstOrThrow(entries(), 'entry');
      // "casă" is stressed on the first "a".
      expect(e.pronunciations[0]?.stressMark).toBe('cásă');
    });

    it('reports no syllabification, because DOOM gives none for this word', () => {
      // The old synthetic fixture claimed "ca-să"; the real page carries no
      // "desp." for casă -- DOOM only marks it where it is non-obvious.
      const e = firstOrThrow(entries(), 'entry');
      expect(e.pronunciations[0]?.syllabification).toBeUndefined();
    });

    it('carries no senses (DOOM is orthographic, not semantic)', () => {
      expect(firstOrThrow(entries(), 'entry').senses).toEqual([]);
    });

    it('validates against the entry schema', () => {
      for (const e of entries()) NormalizedEntry.parse(e);
    });
  });

  describe('molie-de-casă (syllabification is present here)', () => {
    it('extracts the desp. hint from the tooltip markup', () => {
      const e = parseDoom(fixture('doom', 'casă'), 'molie-de-casă');
      expect(firstOrThrow(e, 'entry').pronunciations[0]?.syllabification).toBe('-li-e-');
    });
  });

  describe('merge', () => {
    const entries = () => parseDoom(fixture('doom', 'merge'), 'merge');

    it('decodes HTML entities in forms', () => {
      // The page serves &icirc; / &acirc;; a raw regex strip leaves them literal.
      expect(JSON.stringify(entries())).not.toMatch(/&(icirc|acirc|nbsp|amp);/);
    });

    it('identifies the verb and fabricates no senses', () => {
      const e = firstOrThrow(entries(), 'entry');
      expect(e.partOfSpeech).toBe('verb');
      expect(e.senses).toEqual([]);
    });

    it('splits the two homonyms rather than merging them', () => {
      // merge1 (a o duce) and merge2 (a umbla) are distinct entries.
      expect(entries().length).toBeGreaterThanOrEqual(2);
    });

    it('extracts conjugated forms DOOM lists explicitly', () => {
      const forms = entries().flatMap((e) => e.inflections.map((i) => i.form));
      expect(forms).toContain('meargă');
      expect(forms).toContain('mers');
    });

    it('validates against the entry schema', () => {
      for (const e of entries()) NormalizedEntry.parse(e);
    });
  });

  describe('degenerate input', () => {
    it('returns [] on empty body', () => {
      expect(parseDoom('', 'casă')).toEqual([]);
    });

    it('returns [] for a word with no results', () => {
      expect(parseDoom(fixture('doom', 'zzzqqq'), 'zzzqqq')).toEqual([]);
    });
  });
});
