import { describe, expect, it } from 'vitest';
import { parseWiktionary } from '../../src/providers/wiktionary/parse.js';
import { NormalizedEntry } from '../../src/schema/entry.js';
import { firstOrThrow, fixture } from '../helpers.js';

/**
 * Golden tests against real ro.wiktionary wikitext.
 *
 * ro.wiktionary uses Romanian template names, which the previous parser did not
 * look for at all -- it searched for `{{ro-substantiv}}`, `==Substantiv==` and
 * `{{IPA|…}}`, none of which appear on the site. The real markup for `casă` is:
 *
 *   {{-etimologie-}}   Din latină ''[[casa]]''.
 *   {{-pronunție-}}    * {{AFI}}: {{AFI|/'ka.sə/}}
 *   {{-substantiv-|ron}}
 *   {{substantiv-ron |gen={{f}} |nom-sg=casă |nom-pl=case |art-sg=casa
 *    |art-pl=casele |dat-sg=casei |dat-pl=caselor |voc-sg=casă |voc-pl=caselor}}
 *   #<10 numbered senses>
 *   #:'''''Casa''' de Habsburg.''      <- an example, not a sense
 *   {{-sin-}} {{-deriv-}} {{-comp-}} {{-loc-}} {{-hiper-}} {{-expr-}}
 */
describe('WiktionaryParser', () => {
  describe('casă', () => {
    const entry = () => firstOrThrow(parseWiktionary(fixture('wiktionary', 'casă'), 'casă'), 'entry');

    it('reads the part of speech from {{-substantiv-|ron}}', () => {
      expect(entry().partOfSpeech).toBe('substantiv');
    });

    it('reads gender from the {{f}} template', () => {
      expect(entry().gender).toBe('feminin');
    });

    it('reads IPA from {{AFI}}, normalising the ASCII stress apostrophe', () => {
      // The source writes /'ka.sə/ with U+0027; IPA stress is U+02C8.
      const ipa = entry().pronunciations.map((p) => p.ipa);
      expect(ipa).toContain('/ˈka.sə/');
    });

    it('does not emit the same pronunciation twice', () => {
      // {{AFI|/'ka.sə/}} appears once per language section in the page.
      const ipa = entry().pronunciations.map((p) => p.ipa);
      expect(new Set(ipa).size).toBe(ipa.length);
    });

    it('reads the etymology section', () => {
      expect(entry().etymology?.text).toBe('Din latină casa.');
      expect(entry().etymology?.languages).toContain('latină');
    });

    it('extracts the full declension from {{substantiv-ron}}', () => {
      const forms = entry().inflections;
      const byForm = (f: string) => forms.find((i) => i.form === f);
      expect(byForm('case')?.tags).toEqual(expect.arrayContaining(['nominative', 'plural']));
      expect(byForm('casa')?.tags).toEqual(expect.arrayContaining(['articulated', 'singular']));
      expect(byForm('casele')?.tags).toEqual(expect.arrayContaining(['articulated', 'plural']));
      expect(byForm('casei')?.tags).toEqual(expect.arrayContaining(['dative', 'singular']));
      expect(byForm('caselor')?.tags).toEqual(expect.arrayContaining(['dative', 'plural']));
      expect(forms.length).toBeGreaterThanOrEqual(6);
    });

    it('takes senses only from the # lines under the POS section', () => {
      const senses = entry().senses;
      expect(senses.length).toBe(10);
      expect(senses[0]?.text).toMatch(/^clădire destinată pentru a servi de locuință omului\.$/i);
    });

    it('never treats derived terms or compounds as senses', () => {
      // Regression: the old parser walked every list in every section and
      // emitted 66 "senses", of which ~54 were these.
      const texts = entry().senses.map((s) => s.text);
      for (const notASense of [
        'acasă',
        'casnic',
        'căscioară',
        'căsuță',
        'casă de amanet',
        'casa scării',
        'clădire',
        'localitate',
        ':',
      ]) {
        expect(texts).not.toContain(notASense);
      }
    });

    it('numbers senses consecutively from 1', () => {
      // Regression: numbering used to restart mid-list (1..7 then 1..3).
      expect(entry().senses.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    it('renders wikilinks as plain text', () => {
      const joined = entry().senses.map((s) => s.text).join(' ');
      expect(joined).not.toMatch(/\[\[|\]\]/);
      // [[avea|având]] must render as the label, not the target.
      expect(joined).toContain('având');
      expect(joined).not.toMatch(/\bavea\|/);
    });

    it('attaches the #: line as an example rather than a sense', () => {
      const dinastie = entry().senses.find((s) => /dinastie/i.test(s.text));
      expect(dinastie?.examples.map((e) => e.text).join(' ')).toMatch(/Casa de Habsburg/);
    });

    it('reads the register label on sense 2', () => {
      const sense = entry().senses.find((s) => /cameră/i.test(s.text));
      expect(sense?.register).toContain('regional');
    });

    it('puts {{-sin-}} entries into synonyms', () => {
      const syn = entry().senses.flatMap((s) => s.synonyms);
      expect(syn).toEqual(expect.arrayContaining(['locuință', 'clădire', 'locaș']));
    });

    it('validates against the entry schema', () => {
      NormalizedEntry.parse(entry());
    });
  });

  describe('degenerate input', () => {
    it('returns [] when the API reports an error', () => {
      expect(parseWiktionary('{"error":{"code":"missingtitle","info":"x"}}', 'foo')).toEqual([]);
    });

    it('returns [] for a non-word page', () => {
      expect(parseWiktionary(fixture('wiktionary', 'zzzqqq'), 'zzzqqq')).toEqual([]);
    });

    it('returns [] for malformed JSON', () => {
      expect(parseWiktionary('not json', 'casă')).toEqual([]);
    });
  });
});
