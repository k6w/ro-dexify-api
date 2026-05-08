import { describe, expect, it } from 'vitest';
import { parseForvo } from '../../src/providers/forvo/parse.js';
import { NormalizedEntry } from '../../src/schema/entry.js';

describe('ForvoParser', () => {
  it('maps audio URLs to pronunciations', () => {
    const body = JSON.stringify({
      items: [
        { id: 1, word: 'casă', pathmp3: 'https://forvo.cdn.example/casa.mp3', username: 'alice' },
        { id: 2, word: 'casă', pathmp3: 'https://forvo.cdn.example/casa2.mp3', username: 'bob' },
      ],
    });
    const entries = parseForvo(body, 'casă');
    expect(entries.length).toBe(1);
    const e = entries[0]!;
    expect(e.pronunciations.length).toBe(2);
    expect(e.pronunciations[0]?.audioUrl).toBe('https://forvo.cdn.example/casa.mp3');
    expect(e.senses).toEqual([]);
    NormalizedEntry.parse(e);
  });

  it('returns [] when no items', () => {
    expect(parseForvo('{"items":[]}', 'x')).toEqual([]);
  });
});
