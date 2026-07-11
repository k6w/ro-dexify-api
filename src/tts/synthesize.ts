/**
 * Speech synthesis for words Commons has no recording of.
 *
 * espeak-ng compiled to WebAssembly (`text2wav`): pure Node, no binary to
 * install and no model to download, so `/v1/tts` works on a fresh clone and
 * inside a plain container. It sounds synthetic, but it is phonetically correct
 * -- and correctness is the point, since this is a pronunciation API.
 *
 * It is driven by the IPA from src/phonetics rather than by the spelling, so
 * the transcription verified against Wiktionary is what gets spoken instead of
 * espeak's own guess at Romanian orthography.
 */
import { transcribe } from '../phonetics/index.js';

export interface Synthesized {
  bytes: Buffer;
  mime: string;
  engine: 'espeak';
  /** The IPA actually spoken. */
  ipa: string;
}

export interface SynthesizeOptions {
  /** Lemma accented on the stressed vowel, from DOOM or DEXonline. */
  stressMark?: string;
  /** Words per minute; espeak's default (175) is fast for a single word. */
  speed?: number;
}

/**
 * espeak accepts an IPA string when it is wrapped in `[[...]]`, but its Kirshenbaum
 * notation differs from IPA in a few places. Mapping the handful of Romanian
 * phonemes that differ is more reliable than hoping espeak's own Romanian
 * letter-to-sound rules agree with ours.
 */
const IPA_TO_ESPEAK: Array<[RegExp, string]> = [
  [/t͡ʃ/g, 'tS'],
  [/d͡ʒ/g, 'dZ'],
  [/t͡s/g, 'ts'],
  [/ʃ/g, 'S'],
  [/ʒ/g, 'Z'],
  [/ə/g, '@'],
  [/ɨ/g, 'i"'],
  [/ɡ/g, 'g'],
  [/e̯/g, 'e'],
  [/o̯/g, 'o'],
  [/ˈ/g, "'"],
  [/ʲ/g, ';'],
];

function ipaToEspeak(ipa: string): string {
  let out = ipa.replace(/^\/|\/$/g, '');
  for (const [re, to] of IPA_TO_ESPEAK) out = out.replace(re, to);
  return out;
}

/**
 * Synthesise `word` to WAV bytes.
 *
 * Never throws for ordinary input: a word espeak cannot phonemise still comes
 * back as audio, because a pronunciation endpoint that returns an error is
 * worse than one that returns an imperfect reading.
 */
export async function synthesize(
  word: string,
  options: SynthesizeOptions = {},
): Promise<Synthesized> {
  const transcription = transcribe(
    word,
    options.stressMark ? { stressMark: options.stressMark } : {},
  );

  // Imported lazily: the WASM binary is ~2 MB and most requests are served
  // from Commons or the disk cache without ever needing it.
  const { default: text2wav } = (await import('text2wav')) as unknown as {
    default: (text: string, opts: Record<string, unknown>) => Promise<Uint8Array>;
  };

  const phonemes = ipaToEspeak(transcription.ipa);
  const speed = options.speed ?? 130;

  let bytes: Uint8Array;
  try {
    bytes = await text2wav(`[[${phonemes}]]`, { voice: 'ro', speed });
  } catch {
    // Fall back to the spelling. Romanian is phonemic enough that espeak's own
    // rules are a reasonable second choice.
    bytes = await text2wav(word, { voice: 'ro', speed });
  }

  return {
    bytes: Buffer.from(bytes),
    mime: 'audio/wav',
    engine: 'espeak',
    ipa: transcription.ipa,
  };
}
