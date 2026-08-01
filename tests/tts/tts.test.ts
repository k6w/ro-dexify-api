import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { getLogger } from '../../src/lib/logger.js';
import { espeakVoice, synthesize } from '../../src/tts/synthesize.js';

const app = buildApp({ logger: getLogger() });

/** RIFF....WAVE — the 12-byte header every WAV file starts with. */
function isWav(bytes: Uint8Array): boolean {
  const head = Buffer.from(bytes.slice(0, 12)).toString('latin1');
  return head.startsWith('RIFF') && head.slice(8, 12) === 'WAVE';
}

describe('synthesize', () => {
  it('produces real WAV bytes, not an empty or truncated buffer', async () => {
    const r = await synthesize('casă', { stressMark: 'cásă' });
    expect(r.engine).toBe('espeak');
    expect(r.mime).toBe('audio/wav');
    expect(isWav(r.bytes)).toBe(true);
    expect(r.bytes.length).toBeGreaterThan(1000);
  });

  it('speaks the IPA we derived, not the raw spelling', async () => {
    // The transcription is what was verified against Wiktionary; espeak's own
    // Romanian letter-to-sound rules are only the fallback.
    expect((await synthesize('casă', { stressMark: 'cásă' })).ipa).toBe('/ˈka.sə/');
  });

  it('still returns audio for a word it cannot really pronounce', async () => {
    // A pronunciation endpoint that errors is worse than one that reads badly.
    const r = await synthesize('zzzqqq');
    expect(isWav(r.bytes)).toBe(true);
  });

  it('handles a multi-word input', async () => {
    expect(isWav((await synthesize('bună ziua')).bytes)).toBe(true);
  });
}, 30_000);

describe('GET /v1/tts/:word', () => {
  // ?engine=espeak keeps these offline; the Commons path is covered by
  // `pnpm check:live` because it depends on a third party.
  const espeak = (word: string, extra = '') =>
    app.request(`/v1/tts/${encodeURIComponent(word)}?engine=espeak${extra}`);

  it('returns audio bytes with an audio content-type', async () => {
    const res = await espeak('casă');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('audio/wav');
    expect(isWav(new Uint8Array(await res.arrayBuffer()))).toBe(true);
  });

  it('does not serialise the audio as JSON', async () => {
    // Regression: passing a Node Buffer to Hono's c.body() returned the whole
    // response as JSON, headers and all.
    const res = await espeak('casă');
    expect(res.headers.get('content-type')).not.toContain('json');
  });

  it('survives non-ASCII attribution and IPA in headers', async () => {
    // Regression: "/ˈka.sə/" and "File:Ro-casă.oga" are not ASCII, and undici
    // rejects such header values, so every word with a human recording 500'd
    // while synthesised (all-ASCII) ones succeeded.
    const res = await espeak('casă');
    expect(res.status).toBe(200);
    const ipa = res.headers.get('x-audio-ipa');
    expect(ipa).toBeTruthy();
    expect(decodeURIComponent(ipa ?? '')).toBe('/ˈka.sə/');
  });

  it('carries engine, licence and attribution on the audio response', async () => {
    const res = await espeak('casă');
    expect(res.headers.get('x-audio-engine')).toBe('espeak');
    expect(res.headers.get('x-audio-license')).toBeTruthy();
    expect(res.headers.get('x-audio-attribution')).toContain('espeak-ng');
  });

  it('returns full-fidelity metadata for ?meta', async () => {
    const res = await espeak('casă', '&meta');
    expect(res.headers.get('content-type')).toContain('json');
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.engine).toBe('espeak');
    // Not percent-encoded here: JSON is UTF-8, only headers are constrained.
    expect(body.ipa).toBe('/ˈka.sə/');
    expect(body.syllabification).toBe('ca-să');
    expect(body.license).toBeTruthy();
    expect(body.attribution).toBeTruthy();
  });

  it('rejects input that is not a headword', async () => {
    const res = await app.request(`/v1/tts/${encodeURIComponent('<script>')}`);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
}, 30_000);

describe('voice selection', () => {
  it('synthesises with a female voice by default', async () => {
    const r = await synthesize('casă', { stressMark: 'cásă' });
    expect(r.voice).toBe('ro+f3');
  });

  it('uses a male variant only when asked', async () => {
    expect((await synthesize('casă', { voice: 'male' })).voice).toBe('ro+m3');
  });

  it('produces different audio for the two voices', async () => {
    // Same phonemes, different speaker: the transcription must not change.
    const f = await synthesize('casă', { voice: 'female' });
    const m = await synthesize('casă', { voice: 'male' });
    expect(f.ipa).toBe(m.ipa);
    expect(Buffer.compare(f.bytes, m.bytes)).not.toBe(0);
  });

  it('honours a TTS_VOICE override', () => {
    // espeakVoice is checked directly rather than through synthesize(), so the
    // test does not have to mutate and restore process.env.
    expect(espeakVoice('female', { TTS_VOICE: 'ro+f5' })).toBe('ro+f5');
    expect(espeakVoice('male', { TTS_VOICE: 'ro+f5' })).toBe('ro+f5');
    expect(espeakVoice('female', {})).toBe('ro+f3');
  });

  it('reports the voice on the endpoint', async () => {
    const res = await app.request('/v1/tts/cas%C4%83?engine=espeak&meta');
    const body = (await res.json()) as { voice?: string; engine: string };
    expect(body.engine).toBe('espeak');
    expect(body.voice).toBe('ro+f3');
  });

  it('serves the male voice on ?voice=male', async () => {
    const res = await app.request('/v1/tts/cas%C4%83?engine=espeak&voice=male&meta');
    expect(((await res.json()) as { voice?: string }).voice).toBe('ro+m3');
  });

  it('caches the two voices separately', async () => {
    // Keying the cache on the word alone would serve whichever was generated
    // first for both.
    const f = await app.request('/v1/tts/lapte?engine=espeak');
    const m = await app.request('/v1/tts/lapte?engine=espeak&voice=male');
    const fb = Buffer.from(await f.arrayBuffer());
    const mb = Buffer.from(await m.arrayBuffer());
    expect(Buffer.compare(fb, mb)).not.toBe(0);
  });
}, 30_000);
