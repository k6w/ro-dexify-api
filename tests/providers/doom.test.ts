import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDoom } from '../../src/providers/doom/parse.js';
import { NormalizedEntry } from '../../src/schema/entry.js';

function fixture(file: string): string {
  return readFileSync(resolve('tests/fixtures/doom', file), 'utf8');
}

describe('DoomParser', () => {
  it('parses noun entries with inflections and syllabification', () => {
    const entries = parseDoom(fixture('casa.html'), 'casă');
    expect(entries.length).toBeGreaterThan(0);
    const e = entries[0]!;
    expect(e.partOfSpeech).toBe('substantiv');
    expect(e.gender).toBe('feminin');
    expect(e.pronunciations[0]?.syllabification).toBe('ca-să');
    expect(e.inflections.some((i) => i.form === 'case' && i.tags.includes('plural'))).toBe(true);
    expect(e.senses).toEqual([]);
    NormalizedEntry.parse(e);
  });

  it('parses verb without fabricating senses', () => {
    const entries = parseDoom(fixture('merge.html'), 'merge');
    expect(entries.length).toBeGreaterThan(0);
    const e = entries[0]!;
    expect(e.partOfSpeech).toBe('verb');
    expect(e.senses).toEqual([]);
    expect(e.pronunciations[0]?.syllabification).toBe('mer-ge');
    NormalizedEntry.parse(e);
  });

  it('returns [] on empty body', () => {
    expect(parseDoom('', 'casă')).toEqual([]);
  });
});
