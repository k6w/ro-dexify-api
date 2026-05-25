import { describe, expect, it } from 'vitest';
import { bracketedGroups, splitTopLevel, stripBracketed } from '../../src/extract/segment.js';

// The string that produced the original bug.
const DOOM_CASA =
  'casă s. f., g.-d. art. casei; pl. case (dar: Casa Corpului Didactic, Casa Regală a României s. proprii f. art.)';

describe('splitTopLevel', () => {
  it('does not split inside parentheses', () => {
    expect(splitTopLevel(DOOM_CASA, [';'])).toEqual([
      'casă s. f., g.-d. art. casei',
      'pl. case (dar: Casa Corpului Didactic, Casa Regală a României s. proprii f. art.)',
    ]);
  });

  it('keeps a parenthetical list as one token when splitting on comma', () => {
    const clause =
      'pl. case (dar: Casa Corpului Didactic, Casa Regală a României s. proprii f. art.)';
    expect(splitTopLevel(clause, [','])).toEqual([clause]);
  });

  it('splits on multiple separators at once', () => {
    expect(splitTopLevel('a, b; c', [',', ';'])).toEqual(['a', 'b', 'c']);
  });

  it('drops empty segments and trims', () => {
    expect(splitTopLevel('  a ,, b ,  ', [','])).toEqual(['a', 'b']);
  });

  it('handles nested brackets', () => {
    expect(splitTopLevel('x (a (b, c), d), y', [','])).toEqual(['x (a (b, c), d)', 'y']);
  });

  it('ignores separators inside double quotes and Romanian quotes', () => {
    expect(splitTopLevel('a, "b, c", d', [','])).toEqual(['a', '"b, c"', 'd']);
    expect(splitTopLevel('a, „b, c”, d', [','])).toEqual(['a', '„b, c”', 'd']);
  });

  it('tolerates unbalanced brackets instead of swallowing the rest', () => {
    expect(splitTopLevel('a), b', [','])).toEqual(['a)', 'b']);
  });

  it('returns [] for empty input', () => {
    expect(splitTopLevel('', [','])).toEqual([]);
  });
});

describe('stripBracketed', () => {
  it('removes the editorial parenthetical', () => {
    expect(stripBracketed('pl. case (dar: Casa Corpului Didactic)')).toBe('pl. case');
  });

  it('removes nested groups entirely', () => {
    expect(stripBracketed('a (b (c)) d')).toBe('a d');
  });

  it('removes a domain hint', () => {
    expect(stripBracketed('gândac-de-casă (insectă)')).toBe('gândac-de-casă');
  });

  it('leaves bracket-free text alone', () => {
    expect(stripBracketed('casei')).toBe('casei');
  });
});

describe('bracketedGroups', () => {
  it('returns each top-level group', () => {
    expect(bracketedGroups('molie-de-casă (crustaceu) (desp. -li-e-) s. f.')).toEqual([
      'crustaceu',
      'desp. -li-e-',
    ]);
  });

  it('returns nested groups as part of the outer one', () => {
    expect(bracketedGroups('a (b (c) d) e')).toEqual(['b (c) d']);
  });

  it('returns [] when there are none', () => {
    expect(bracketedGroups('casă s. f.')).toEqual([]);
  });
});
