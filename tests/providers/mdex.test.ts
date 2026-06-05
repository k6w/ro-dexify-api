import { describe, expect, it } from 'vitest';
import { parseMdex } from '../../src/providers/mdex/parse.js';
import { NormalizedEntry } from '../../src/schema/entry.js';
import { firstOrThrow, fixture } from '../helpers.js';

/**
 * Golden tests against the real m.dex.ro page.
 *
 * Each definition is a `.mydef` block of the form:
 *   <strong>CÁSĂ1,</strong> s. f. 1. Clădire… (<span>Sursa: DEX '98</span>)
 *   <button data-clipboard-text="…">Copy to clipboard</button>
 */
describe('MdexParser', () => {
  const casa = () => parseMdex(fixture('mdex', 'casă'), 'casă');

  it('cleans the headword instead of returning "CÁSĂ1,"', () => {
    for (const e of casa()) {
      expect(e.displayHeadword).not.toMatch(/[,;:]$/);
      expect(e.displayHeadword).not.toMatch(/\d$/);
    }
  });

  it('identifies the part of speech', () => {
    expect(firstOrThrow(casa(), 'entry').partOfSpeech).toBe('substantiv');
  });

  it('splits the numbered senses', () => {
    expect(firstOrThrow(casa(), 'entry').senses.length).toBeGreaterThanOrEqual(2);
  });

  it('records which dictionary each definition came from', () => {
    const titles = casa().map((e) => e.source.workTitle);
    expect(titles.filter(Boolean).length).toBeGreaterThan(0);
    expect(titles).toContain("DEX '98");
  });

  it('does not leak the "Sursa:" note into the definition text', () => {
    const text = casa()
      .flatMap((e) => e.senses.map((s) => s.text))
      .join(' ');
    expect(text).not.toMatch(/Sursa\s*:/i);
  });

  it('does not duplicate the definition from the clipboard button', () => {
    const text = casa()
      .flatMap((e) => e.senses.map((s) => s.text))
      .join(' ');
    expect(text).not.toMatch(/Copy to clipboard/i);
  });

  it('validates against the entry schema', () => {
    for (const e of casa()) NormalizedEntry.parse(e);
  });

  it('returns [] for an empty body', () => {
    expect(parseMdex('', 'casă')).toEqual([]);
  });

  it('returns [] for a page with no definitions', () => {
    expect(parseMdex(fixture('mdex', 'zzzqqq'), 'zzzqqq')).toEqual([]);
  });
});
