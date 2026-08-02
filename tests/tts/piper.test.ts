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
  it('is unconfigured when the env vars are absent', () => {
    expect(piperConfig({})).toBeUndefined();
    expect(isPiperAvailable({})).toBe(false);
  });

  it('is unconfigured when only one of the two is set', () => {
    expect(piperConfig({ PIPER_BIN: '/usr/local/bin/piper' })).toBeUndefined();
    expect(piperConfig({ PIPER_MODEL: '/opt/voices/ro.onnx' })).toBeUndefined();
  });

  it('is unconfigured when the paths do not exist', () => {
    // A stale path must fall through to espeak rather than fail every request.
    expect(
      piperConfig({ PIPER_BIN: '/nope/piper', PIPER_MODEL: '/nope/ro_RO-mihai-medium.onnx' }),
    ).toBeUndefined();
  });
});

describe('synthesizeWithPiper', () => {
  it('returns undefined rather than throwing when unconfigured', async () => {
    await expect(synthesizeWithPiper('casă', {})).resolves.toBeUndefined();
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

  it('reports Piper as unavailable instead of silently using espeak', async () => {
    // Pinning a tier and quietly getting another makes it impossible to tell
    // whether Piper is configured -- which is the thing you are checking when
    // you name it.
    const res = await app.request('/v1/tts/cas%C4%83?engine=piper');
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toMatch(/PIPER_BIN/);
    expect(body.error.message).toMatch(/pnpm voices/);
  });

  it('still serves espeak when pinned', async () => {
    const res = await app.request('/v1/tts/cas%C4%83?engine=espeak&meta');
    expect(res.status).toBe(200);
    expect(((await res.json()) as { engine: string }).engine).toBe('espeak');
  });
}, 30_000);
