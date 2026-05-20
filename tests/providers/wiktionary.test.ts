import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseWiktionary } from '../../src/providers/wiktionary/parse.js';
import { NormalizedEntry } from '../../src/schema/entry.js';
import { firstOrThrow } from '../helpers.js';

describe('WiktionaryParser', () => {
  it('extracts wikitext senses, IPA, and etymology', () => {
    const json = readFileSync(resolve('tests/fixtures/wiktionary/casa.json'), 'utf8');
    const entries = parseWiktionary(json, 'casă');
    expect(entries.length).toBe(1);
    const e = firstOrThrow(entries, 'entry');
    expect(e.partOfSpeech).toBe('substantiv');
    expect(e.pronunciations.some((p) => p.ipa === '/ˈka.sə/')).toBe(true);
    expect(e.senses.length).toBeGreaterThan(0);
    NormalizedEntry.parse(e);
  });

  it('returns [] when API returns error', () => {
    expect(parseWiktionary('{"error":{"code":"missingtitle","info":"x"}}', 'foo')).toEqual([]);
  });
});
