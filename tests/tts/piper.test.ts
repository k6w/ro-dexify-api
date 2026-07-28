import { describe, expect, it } from 'vitest';
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
