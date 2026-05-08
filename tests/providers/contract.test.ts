import { describe, expect, it } from 'vitest';
import { listProviders } from '../../src/providers/registry.js';

describe('Provider contract', () => {
  for (const provider of listProviders()) {
    describe(provider.meta.id, () => {
      it('has well-formed meta', () => {
        expect(provider.meta.id).toBeTruthy();
        expect(provider.meta.name).toBeTruthy();
        expect(provider.meta.license).toBeTruthy();
        expect(provider.meta.attribution).toBeTruthy();
        expect(provider.meta.capabilities.size).toBeGreaterThan(0);
        expect(provider.meta.ttlSeconds).toBeGreaterThan(0);
      });

      const localProvider = ['conjugare', 'pluralro'].includes(provider.meta.id);
      const httpProvider = !localProvider;
      it.skipIf(localProvider)('parse("", word) returns []', () => {
        expect(provider.parse('', 'casă')).toEqual([]);
      });

      it('buildUrl returns a string', () => {
        expect(typeof provider.buildUrl('casă')).toBe('string');
      });

      it.skipIf(httpProvider)('local providers compute via parse for valid input', () => {
        const result = provider.parse('', 'casă');
        expect(Array.isArray(result)).toBe(true);
      });
    });
  }
});
