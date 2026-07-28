import { describe, expect, it } from 'vitest';
import { parseForvo } from '../../src/providers/forvo/parse.js';
import { NormalizedEntry } from '../../src/schema/entry.js';
import { firstOrThrow } from '../helpers.js';

/**
 * Forvo needs a paid API key, so these assert against the response shape Forvo
 * documents for `word-pronunciations` rather than a recorded fixture. If a key
 * becomes available, record a real response with
 * `pnpm fixtures:refresh -- --source forvo` and switch these over; the shape
 * asserted here is what the parser reads and no more.
 *
 * The field names below are Forvo's own: `items[]`, `pathmp3`, `pathogg`,
 * `username`, `num_positive_votes`, `attributes.total`.
 */
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
    const e = firstOrThrow(entries, 'entry');
    expect(e.pronunciations.length).toBe(2);
    expect(e.pronunciations[0]?.audioUrl).toBe('https://forvo.cdn.example/casa.mp3');
    expect(e.senses).toEqual([]);
    NormalizedEntry.parse(e);
  });

  it('returns [] when no items', () => {
    expect(parseForvo('{"items":[]}', 'x')).toEqual([]);
  });

  it('credits the speaker, as the licence requires', () => {
    const body = JSON.stringify({
      attributes: { total: 1 },
      items: [
        {
          id: 7,
          word: 'casă',
          pathmp3: 'https://forvo.cdn.example/casa.mp3',
          pathogg: 'https://forvo.cdn.example/casa.ogg',
          username: 'ana',
          language: 'ro',
          num_positive_votes: 3,
        },
      ],
    });
    const e = firstOrThrow(parseForvo(body, 'casă'), 'entry');
    expect(e.pronunciations[0]?.audioAttribution).toBe('Forvo: ana');
    expect(e.pronunciations[0]?.audioMime).toBe('audio/mpeg');
  });

  it('skips items with no audio rather than emitting an empty pronunciation', () => {
    const body = JSON.stringify({ items: [{ id: 1, word: 'casă', username: 'ana' }] });
    expect(parseForvo(body, 'casă')).toEqual([]);
  });

  it('returns [] for a malformed body', () => {
    expect(parseForvo('<html>not json</html>', 'casă')).toEqual([]);
    expect(parseForvo('', 'casă')).toEqual([]);
  });

  it('carries no senses — Forvo is an audio source', () => {
    const body = JSON.stringify({
      items: [{ id: 1, word: 'casă', pathmp3: 'https://x/a.mp3', username: 'ana' }],
    });
    expect(firstOrThrow(parseForvo(body, 'casă'), 'entry').senses).toEqual([]);
  });
});
