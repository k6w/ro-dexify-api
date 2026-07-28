/**
 * Pronunciation audio selection.
 *
 * Tiers, best first:
 *   1. a human recording from Wikimedia Commons / Lingua Libre
 *   2. Piper neural TTS, when the operator has configured it (see ./piper.ts)
 *   3. espeak-ng (WASM) driven by our own IPA -- always available
 *
 * Every result names the engine and carries the licence and attribution that
 * apply to it, because tier 1 is CC-licensed third-party material and tier 2 is
 * generated here.
 *
 * Synthesised bytes are cached on disk: espeak is fast but not free, and the
 * output for a word never changes.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Logger } from '../lib/logger.js';
import { transcribe } from '../phonetics/index.js';
import { findHumanRecording } from './commons.js';
import { synthesizeWithPiper } from './piper.js';
import { synthesize } from './synthesize.js';

export interface Pronunciation {
  bytes: Buffer;
  mime: string;
  engine: 'commons' | 'piper' | 'espeak';
  license: string;
  attribution: string;
  /** Upstream URL for a human recording; absent for synthesised audio. */
  sourceUrl?: string;
  ipa: string;
  syllabification: string;
  stressOrigin: 'attested' | 'derived';
}

export interface PronounceOptions {
  stressMark?: string;
  /** Skip Commons and synthesise directly. */
  synthesizeOnly?: boolean;
  /** Force espeak, skipping Piper too. Used by the tests to stay deterministic. */
  forceEspeak?: boolean;
  logger: Logger;
}

const CACHE_DIR = resolve('.cache/tts');

function cachePath(word: string, engine: string): string {
  const key = createHash('sha256').update(`${engine}:${word}`).digest('hex').slice(0, 16);
  return join(CACHE_DIR, `${engine}-${key}`);
}

function readCache(path: string): Buffer | undefined {
  try {
    return existsSync(path) ? readFileSync(path) : undefined;
  } catch {
    return undefined;
  }
}

function writeCache(path: string, bytes: Buffer): void {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(path, bytes);
  } catch {
    // A read-only filesystem must not break pronunciation.
  }
}

export async function pronounce(word: string, opts: PronounceOptions): Promise<Pronunciation> {
  const transcription = transcribe(word, opts.stressMark ? { stressMark: opts.stressMark } : {});

  if (!opts.synthesizeOnly) {
    try {
      const human = await findHumanRecording(word, opts.logger);
      if (human) {
        const path = cachePath(`${word}|${human.url}`, 'commons');
        let bytes = readCache(path);
        if (!bytes) {
          const res = await fetch(human.url, {
            headers: { 'user-agent': 'ro-dexify-api/2.0 (+pronunciation)' },
          });
          if (res.ok) {
            bytes = Buffer.from(await res.arrayBuffer());
            writeCache(path, bytes);
          }
        }
        if (bytes && bytes.length > 0) {
          return {
            bytes,
            mime: human.mime,
            engine: 'commons',
            license: human.license,
            attribution: `${human.attribution} — via Wikimedia Commons (${human.file})`,
            sourceUrl: human.url,
            ipa: transcription.ipa,
            syllabification: transcription.syllabification,
            stressOrigin: transcription.stressOrigin,
          };
        }
      }
    } catch (err) {
      // A Commons outage falls through to synthesis rather than failing.
      opts.logger.warn({ word, err: String(err) }, 'commons_audio_failed');
    }
  }

  // Piper is a quality upgrade and is skipped silently when not configured.
  const piperPath = cachePath(word, 'piper');
  const piperCached = readCache(piperPath);
  const piper = opts.forceEspeak
    ? undefined
    : piperCached
      ? { bytes: piperCached, mime: 'audio/wav' as const, engine: 'piper' as const }
      : await synthesizeWithPiper(word);
  if (piper) {
    if (!piperCached) writeCache(piperPath, piper.bytes);
    return {
      bytes: piper.bytes,
      mime: piper.mime,
      engine: 'piper',
      license: 'MIT',
      attribution: 'Synthesised by ro-dexify-api using Piper (ro_RO-mihai-medium)',
      ipa: transcription.ipa,
      syllabification: transcription.syllabification,
      stressOrigin: transcription.stressOrigin,
    };
  }

  const path = cachePath(word, 'espeak');
  const cached = readCache(path);
  const synth = cached
    ? { bytes: cached, mime: 'audio/wav', engine: 'espeak' as const, ipa: transcription.ipa }
    : await synthesize(word, opts.stressMark ? { stressMark: opts.stressMark } : {});
  if (!cached) writeCache(path, synth.bytes);

  return {
    bytes: synth.bytes,
    mime: synth.mime,
    engine: 'espeak',
    license: 'CC0-1.0',
    attribution: 'Synthesised by ro-dexify-api using espeak-ng (GPL-3.0)',
    ipa: transcription.ipa,
    syllabification: transcription.syllabification,
    stressOrigin: transcription.stressOrigin,
  };
}
