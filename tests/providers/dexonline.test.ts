import { describe, expect, it } from 'vitest';
import { parseDexonline } from '../../src/providers/dexonline/parse.js';
import { EntryV2 } from '../../src/schema/entry-v2.js';
import { firstOrThrow, fixture } from '../helpers.js';

/**
 * Golden tests against the real DEXonline JSON API.
 *
 * The recorded `casă` fixture holds 120 definitions drawn from 32 dictionaries.
 * The old HTML-scraping parser returned all 120 as entries, each with exactly
 * one "sense" containing the whole definition as an undivided blob, and an
 * etymology regex that matched "Din" inside "Dinastie".
 */
describe('DexonlineParser', () => {
  const casa = (opts = {}) => parseDexonline(fixture('dexonline', 'casă'), 'casă', opts);

  describe('casă', () => {
    it("ranks DEX '09 first, ahead of 1929 and 1939 dictionaries", () => {
      expect(firstOrThrow(casa(), 'entry').source.workTitle).toBe("DEX '09");
    });

    it('caps the default response instead of returning all 120', () => {
      const entries = casa();
      expect(entries.length).toBeLessThanOrEqual(8);
      expect(entries.length).toBeGreaterThan(0);
    });

    it('returns everything when asked', () => {
      // 120 raw definitions; 28 survive exact-lemma matching and the
      // orthographic exclusion, all returned without deduplication.
      expect(casa({ all: true }).length).toBeGreaterThan(20);
      expect(casa({ all: true, includeRelated: true }).length).toBeGreaterThan(
        casa({ all: true }).length,
      );
    });

    it('honours a dictionary filter', () => {
      const only = casa({ dictionaries: ["DEX '09"], all: true });
      expect(only.length).toBeGreaterThan(0);
      for (const e of only) expect(e.source.workTitle).toBe("DEX '09");
    });

    it('splits the numbered senses instead of returning one blob', () => {
      // Regression: every entry used to carry exactly 1 sense.
      const first = firstOrThrow(casa(), 'entry');
      expect(first.senses.length).toBeGreaterThanOrEqual(8);
      expect(first.senses[0]?.text).toBe('Clădire care servește drept locuință.');
      expect(first.senses.map((s) => s.number)).toEqual(
        expect.arrayContaining([1, 2, 3, 4, 5, 6, 7, 8]),
      );
    });

    it('reads part of speech and gender from the grammatical preamble', () => {
      const first = firstOrThrow(casa(), 'entry');
      expect(first.partOfSpeech).toBe('substantiv');
      expect(first.gender).toBe('feminin');
    });

    it('recovers the tonic accent DEXonline encodes as an apostrophe', () => {
      expect(firstOrThrow(casa(), 'entry').pronunciations[0]?.stressMark).toBe('CÁSĂ');
    });

    it('reads the etymology and never matches "Din" inside a word', () => {
      // Regression: produced etymology "astie; neam" from "Dinastie; neam".
      const first = firstOrThrow(casa(), 'entry');
      expect(first.etymology?.text).toBe('Lat. casa.');
      for (const e of casa({ all: true })) {
        if (e.etymology) expect(e.etymology.text).not.toMatch(/^astie/);
      }
    });

    it('leaves no markup sigils or decorative markers in sense text', () => {
      const text = casa({ all: true })
        .flatMap((e) => e.senses.map((s) => s.text))
        .join(' ');
      expect(text).not.toMatch(/[@$#%◼■⦿]/);
      expect(text).not.toMatch(/&#\d+;|&[a-z]+;/);
    });

    it('strips the tonic-accent apostrophe from running text', () => {
      // "c'asei" must read "casei".
      const text = casa({ all: true })
        .flatMap((e) => e.senses.map((s) => s.text))
        .join(' ');
      expect(text).not.toMatch(/\p{L}'[aăâeiîou]/u);
    });

    it('excludes other lemmas returned by the same search', () => {
      const heads = casa({ all: true }).map((e) => e.headword.toLowerCase());
      for (const other of ['casă-muzeu', 'molie-de-casă', 'gândac', 'gândac-de-casă']) {
        expect(heads).not.toContain(other);
      }
    });

    it('excludes DOOM entries, which carry grammar but no definitions', () => {
      // DEXonline's DOOM copy has authority 98 and no definition text, so left
      // in it pushed every real definition off the front of the response.
      const titles = casa({ all: true }).map((e) => e.source.workTitle);
      expect(titles).not.toContain('DOOM 3');
      expect(titles).not.toContain('Ortografic');
    });

    it('keeps DOOM entries when explicitly requested', () => {
      const titles = casa({ all: true, includeOrthographic: true }).map((e) => e.source.workTitle);
      expect(titles).toContain('DOOM 3');
    });

    it('records the contributing dictionary on every entry', () => {
      for (const e of casa({ all: true })) {
        expect(e.source.workTitle).toBeTruthy();
        expect(e.source.attribution).toContain(e.source.workTitle ?? '');
      }
    });

    it('collapses near-duplicate senses across dictionaries', () => {
      expect(casa().length).toBeLessThan(casa({ all: true }).length);
    });

    it('does not return the verb "casa" for the noun "casă"', () => {
      // Both fold to "casa", so diacritic-insensitive matching alone merged two
      // distinct lemmas and put "A anula o hotărâre judecătorească" under casă.
      for (const e of casa({ all: true })) {
        expect(e.headword).toBe('casă');
      }
    });

    it('still resolves an unaccented query through folding', () => {
      const viaFold = parseDexonline(fixture('dexonline', 'casa'), 'casa');
      expect(viaFold.length).toBeGreaterThan(0);
    });

    it('nests locutions and sub-senses as typed children, not as senses', () => {
      const first = firstOrThrow(casa(), 'entry');
      const kinds = new Set(first.senses.flatMap((s) => s.children.map((c) => c.type)));
      expect(kinds.has('sub-meaning') || kinds.has('locution') || kinds.has('expression')).toBe(
        true,
      );
      // A ◊/♦ item must never appear as a top-level sense.
      expect(first.senses.map((s) => s.text)).not.toContain('Cameră, odaie.');
    });

    it('attributes every sense to its contributing dictionary', () => {
      const first = firstOrThrow(casa(), 'entry');
      expect(first.senses[0]?.sources).toContain("DEX '09");
    });

    it('records the homonym index', () => {
      expect(firstOrThrow(casa(), 'entry').homonymIndex).toBe(1);
    });

    it('validates against the entry schema', () => {
      for (const e of casa({ all: true })) EntryV2.parse(e);
    });
  });

  describe('degenerate input', () => {
    it('returns [] for an empty body', () => {
      expect(parseDexonline('', 'casă')).toEqual([]);
    });

    it('returns [] for malformed JSON', () => {
      expect(parseDexonline('<html>not json</html>', 'casă')).toEqual([]);
    });

    it('returns [] for a word with no definitions', () => {
      expect(parseDexonline(fixture('dexonline', 'zzzqqq'), 'zzzqqq')).toEqual([]);
    });
  });
});
