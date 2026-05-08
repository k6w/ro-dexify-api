import { describe, expect, it } from 'vitest';
import { pluralize } from '../../src/providers/pluralro/index.js';

describe('pluralize', () => {
  it('feminine -ă → -e (casă)', () => {
    const r = pluralize('casă');
    expect(r?.plural).toBe('case');
    expect(r?.gender).toBe('feminin');
    expect(r?.confident).toBe(true);
  });

  it('feminine -ie → -ii (familie)', () => {
    const r = pluralize('familie');
    expect(r?.plural).toBe('familii');
  });

  it('returns undefined on empty', () => {
    expect(pluralize('')).toBeUndefined();
  });
});
