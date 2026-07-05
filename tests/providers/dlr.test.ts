import { describe, expect, it } from 'vitest';
import { listProviders } from '../../src/providers/registry.js';

/**
 * DLR is disabled because its upstream endpoint no longer exists.
 *
 * `dlr1.solirom.ro/index.php?cuv=<word>` returns HTTP 404 for every word; the
 * site is now a browser-only application that resolves words client-side, so
 * there is no server-rendered page to fetch or record.
 *
 * This test exists so the situation is asserted rather than remembered: if
 * someone re-enables the provider without restoring a real endpoint, it fails
 * here instead of adding a failing provider to every response.
 */
describe('DlrProvider', () => {
  const dlr = () => listProviders().find((p) => p.meta.id === 'dlr');

  it('is registered but disabled', () => {
    expect(dlr()).toBeDefined();
    expect(dlr()?.meta.enabled).toBe(false);
  });

  it('stays disabled even when ENABLE_DLR is set', () => {
    // meta is computed at construction from ENABLE_DLR && DLR_ENDPOINT_AVAILABLE.
    process.env.ENABLE_DLR = 'true';
    expect(dlr()?.meta.enabled).toBe(false);
    process.env.ENABLE_DLR = 'false';
  });

  it('does not appear in the default aggregate set', () => {
    expect(
      listProviders()
        .filter((p) => p.meta.enabled)
        .map((p) => p.meta.id),
    ).not.toContain('dlr');
  });
});
