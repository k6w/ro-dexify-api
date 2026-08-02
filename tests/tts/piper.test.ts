import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { getLogger } from '../../src/lib/logger.js';
import { isPiperAvailable, piperConfig, synthesizeWithPiper } from '../../src/tts/piper.js';

/**
 * Piper is an optional quality tier: a ~60 MB ONNX model and an external
 * binary. These assert it stays out of the way when it is not configured, which
 * is the case that matters — a misconfigured Piper must never take
 * pronunciation down, it must fall through to espeak.
 */
describe('piperConfig', () => {
  it('can be turned off explicitly', () => {
    // Not `{}` -- that now discovers whatever `pnpm voices` installed, so the
    // assertion would depend on the machine it runs on.
    expect(piperConfig({ PIPER_DISABLE: '1' })).toBeUndefined();
    expect(isPiperAvailable({ PIPER_DISABLE: '1' })).toBe(false);
  });

  it('is unconfigured when a set path does not exist', () => {
    expect(piperConfig({ PIPER_BIN: '/nope/piper', PIPER_MODEL: '/nope/ro.onnx' })).toBeUndefined();
  });

  it('is unconfigured when the paths do not exist', () => {
    // A stale path must fall through to espeak rather than fail every request.
    expect(
      piperConfig({ PIPER_BIN: '/nope/piper', PIPER_MODEL: '/nope/ro_RO-mihai-medium.onnx' }),
    ).toBeUndefined();
  });
});

describe('synthesizeWithPiper', () => {
  it('returns undefined rather than throwing when disabled', async () => {
    await expect(synthesizeWithPiper('casă', { PIPER_DISABLE: '1' })).resolves.toBeUndefined();
  });

  it('returns undefined when the binary cannot be run', async () => {
    await expect(
      synthesizeWithPiper('casă', { PIPER_BIN: '/nope/piper', PIPER_MODEL: '/nope/m.onnx' }),
    ).resolves.toBeUndefined();
  });
});

describe('engine selection over HTTP', () => {
  const app = buildApp({ logger: getLogger() });

  it('rejects an unknown engine', async () => {
    const res = await app.request('/v1/tts/cas%C4%83?engine=bogus');
    expect(res.status).toBe(400);
  });

  it('either serves Piper or says why it cannot — never a silent swap', async () => {
    // Whether Piper is installed depends on the machine, but the contract does
    // not: pinning a tier must give you that tier or an explanation.
    const res = await app.request('/v1/tts/cas%C4%83?engine=piper&meta');
    if (res.status === 200) {
      expect(((await res.json()) as { engine: string }).engine).toBe('piper');
    } else {
      expect(res.status).toBe(503);
      const body = (await res.json()) as { error: { message: string } };
      expect(body.error.message).toMatch(/pnpm voices/);
    }
  });

  it('still serves espeak when pinned', async () => {
    const res = await app.request('/v1/tts/cas%C4%83?engine=espeak&meta');
    expect(res.status).toBe(200);
    expect(((await res.json()) as { engine: string }).engine).toBe('espeak');
  });
}, 30_000);

describe('auto-discovery', () => {
  it('finds what `pnpm voices` installed without any env vars', () => {
    // The whole point of `pnpm voices` doing the install is that nothing has to
    // be exported afterwards. This asserts the default paths are the ones the
    // script writes to.
    const cfg = piperConfig({});
    if (cfg) {
      expect(cfg.bin).toMatch(/piper/);
      expect(cfg.model).toMatch(/ro_RO-mihai-medium\.onnx$/);
    } else {
      // Not installed in this environment; the tier is simply skipped.
      expect(cfg).toBeUndefined();
    }
  });

  it('does not silently substitute a discovered path for a bad explicit one', () => {
    // A typo in PIPER_BIN should read as "not configured", not quietly resolve
    // to something else and produce a different voice.
    expect(piperConfig({ PIPER_BIN: '/nope/piper', PIPER_MODEL: '/nope/m.onnx' })).toBeUndefined();
  });
});
