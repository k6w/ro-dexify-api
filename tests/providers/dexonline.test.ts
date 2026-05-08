import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDexonline } from '../../src/providers/dexonline/parse.js';
import { NormalizedEntry } from '../../src/schema/entry.js';

describe('DexonlineParser', () => {
  it('extracts senses, etymology, and gender', () => {
    const html = readFileSync(resolve('tests/fixtures/dexonline/casa.html'), 'utf8');
    const entries = parseDexonline(html, 'casă');
    expect(entries.length).toBeGreaterThan(0);
    const e = entries[0]!;
    expect(e.partOfSpeech).toBe('substantiv');
    expect(e.gender).toBe('feminin');
    expect(e.senses.length).toBeGreaterThanOrEqual(2);
    expect(e.senses[0]?.text).toMatch(/locuin/i);
    expect(e.etymology?.text).toMatch(/casa/i);
    NormalizedEntry.parse(e);
  });

  it('returns [] for empty body', () => {
    expect(parseDexonline('', 'casă')).toEqual([]);
  });
});
