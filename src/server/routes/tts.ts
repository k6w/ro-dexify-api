import { Hono } from 'hono';
import '../context.js';
import { HeadwordParam } from '../../schema/api.js';
import { pronounce } from '../../tts/index.js';

export const ttsRoutes = new Hono();

/**
 * GET /v1/tts/:word          -> audio bytes
 * GET /v1/tts/:word?meta     -> JSON describing the audio and the transcription
 *
 * Attribution travels both ways: in the JSON body, and in X-Audio-* headers on
 * the audio response, since a client streaming the bytes never sees the JSON.
 */
ttsRoutes.get('/tts/:word', async (c) => {
  const word = HeadwordParam.parse(decodeURIComponent(c.req.param('word')));
  const logger = c.get('logger');
  const wantsMeta = c.req.query('meta') !== undefined;
  const forceEspeak = c.req.query('engine') === 'espeak';

  const result = await pronounce(word, {
    logger,
    synthesizeOnly: forceEspeak,
    forceEspeak,
  });

  if (wantsMeta) {
    return c.json({
      word,
      engine: result.engine,
      mime: result.mime,
      bytes: result.bytes.length,
      license: result.license,
      attribution: result.attribution,
      ...(result.sourceUrl ? { sourceUrl: result.sourceUrl } : {}),
      audioUrl: `/v1/tts/${encodeURIComponent(word)}`,
      ipa: result.ipa,
      syllabification: result.syllabification,
      stressOrigin: result.stressOrigin,
    });
  }

  // Header values are percent-encoded because HTTP headers are ASCII and these
  // are not: the attribution carries an em dash and "File:Ro-casă.oga", and the
  // IPA carries "ˈ" and "ə". Setting them raw makes undici reject the response,
  // so a word with a human recording 500'd while a synthesised one (all ASCII)
  // succeeded. Full-fidelity values are in the ?meta JSON.
  return new Response(new Uint8Array(result.bytes), {
    headers: {
      'content-type': result.mime,
      'content-length': String(result.bytes.length),
      'x-audio-engine': result.engine,
      'x-audio-license': asciiHeader(result.license),
      'x-audio-attribution': asciiHeader(result.attribution),
      'x-audio-ipa': asciiHeader(result.ipa),
      'cache-control': 'public, max-age=86400',
    },
  });
});

/** Percent-encode anything outside printable ASCII, so the header is legal. */
function asciiHeader(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, (ch) => encodeURIComponent(ch));
}
