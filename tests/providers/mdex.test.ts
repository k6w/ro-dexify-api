import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseMdex } from '../../src/providers/mdex/parse.js';
import { NormalizedEntry } from '../../src/schema/entry.js';
import { firstOrThrow } from '../helpers.js';

describe('MdexParser', () => {
  it('splits numbered senses', () => {
    const html = readFileSync(resolve('tests/fixtures/mdex/casa.html'), 'utf8');
    const entries = parseMdex(html, 'casă');
    expect(entries.length).toBeGreaterThan(0);
    const e = firstOrThrow(entries, 'entry');
    expect(e.senses.length).toBeGreaterThanOrEqual(2);
    expect(e.partOfSpeech).toBe('substantiv');
    NormalizedEntry.parse(e);
  });
});
