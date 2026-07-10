/**
 * Romanian transcription: spelling in, IPA out.
 *
 * Stress is the one thing spelling does not determine in Romanian, so it is
 * taken from a dictionary wherever one gives it — DOOM marks the stressed vowel
 * with an underline, DEXonline with an apostrophe, and both are already parsed
 * into `Pronunciation.stressMark`. Only when no source says is the regular
 * pattern applied, and the result is reported as low confidence rather than
 * presented as fact.
 */
import { type Phoneme, normalizeWord, toPhonemes } from './g2p.js';
import { type Syllable, syllabify } from './syllabify.js';

export { normalizeWord, toPhonemes } from './g2p.js';
export { syllabify } from './syllabify.js';
export type { Phoneme } from './g2p.js';

export interface Transcription {
  /** Full IPA with stress and syllable dots, e.g. "/ˈka.sə/". */
  ipa: string;
  /** Orthographic syllable division, e.g. "ca-să". */
  syllabification: string;
  /** Zero-based index of the stressed syllable. */
  stressedSyllable: number;
  /** 'attested' when a dictionary supplied the stress, 'derived' otherwise. */
  stressOrigin: 'attested' | 'derived';
  confidence: 'high' | 'low';
}

/**
 * Character index of the stressed vowel in a dictionary's marked form.
 *
 * `stressMark` is the lemma rewritten with an acute accent on the stressed
 * vowel ("cásă", "CÁSĂ"), which is what DOOM and DEXonline both give us. The
 * accent is a combining mark after NFD, so its position identifies the letter.
 *
 * A character index rather than a vowel ordinal, because the two disagree: in
 * "oaie" the letter `o` is the second vowel orthographically but is the glide
 * /o̯/, not a nucleus. Phonemes carry the index of the grapheme that produced
 * them, so a character index maps to a syllable exactly.
 */
export function stressedCharIndex(stressMark: string): number | undefined {
  const decomposed = stressMark.normalize('NFD');
  const at = decomposed.indexOf('́');
  if (at <= 0) return undefined;

  let chars = 0;
  for (let i = 0; i < at; i++) {
    const ch = decomposed[i];
    if (ch === undefined || /\p{M}/u.test(ch)) continue;
    chars++;
  }
  return Math.max(0, chars - 1);
}

/**
 * Regular Romanian stress, used only when no dictionary supplied it.
 *
 * The language has no single rule — this is the common pattern (penultimate for
 * vowel-final words, final for consonant-final ones), right often enough to be
 * useful and always labelled `derived` / low confidence so a caller can tell.
 */
function defaultStressSyllable(syllables: readonly Syllable[]): number {
  if (syllables.length <= 1) return 0;
  const last = syllables[syllables.length - 1];
  // Phoneme-final, not letter-final: "tablou" ends in the letter `u` but in the
  // glide /w/, so it patterns with consonant-final words and takes final stress.
  const endsInVowel = last?.phonemes[last.phonemes.length - 1]?.role === 'vowel';
  return endsInVowel ? syllables.length - 2 : syllables.length - 1;
}

/** Which syllable contains the phoneme produced by a given character. */
function syllableOfChar(syllables: readonly Syllable[], charIndex: number): number {
  for (let s = 0; s < syllables.length; s++) {
    const syllable = syllables[s];
    if (!syllable) continue;
    if (syllable.phonemes.some((p) => p.source === charIndex)) return s;
  }
  return 0;
}

function renderIpa(syllables: readonly Syllable[], stressed: number): string {
  const parts = syllables.map((s) => s.phonemes.map((p) => p.ipa).join(''));
  // A monosyllable has nothing to contrast with, so convention omits the mark.
  if (parts.length <= 1) return parts.join('');
  const withStress = parts.map((p, i) => (i === stressed ? `ˈ${p}` : p));
  // The stress mark already separates syllables, so no dot before it.
  return withStress.reduce((acc, part, i) => {
    if (i === 0) return part;
    return part.startsWith('ˈ') ? `${acc}${part}` : `${acc}.${part}`;
  }, '');
}

/** Split the original spelling at the same points as the phoneme syllables. */
function orthographicSyllables(word: string, syllables: readonly Syllable[]): string {
  if (syllables.length <= 1) return word;
  const cuts: number[] = [];
  let consumed = 0;
  for (const s of syllables.slice(0, -1)) {
    consumed += s.phonemes.length;
    const nextSyllable = syllables[cuts.length + 1];
    const firstOfNext = nextSyllable?.phonemes[0];
    if (firstOfNext) cuts.push(firstOfNext.source);
    else cuts.push(consumed);
  }

  let out = '';
  let prev = 0;
  for (const cut of cuts) {
    if (cut <= prev || cut >= word.length) continue;
    out += `${word.slice(prev, cut)}-`;
    prev = cut;
  }
  return out + word.slice(prev);
}

export interface TranscribeOptions {
  /** Lemma with an acute accent on the stressed vowel, from DOOM or DEXonline. */
  stressMark?: string;
}

/**
 * Transcribe a word. Multi-word input (hyphenated compounds, "a fi") is
 * transcribed part by part and rejoined, since each part carries its own stress.
 */
export function transcribe(rawWord: string, options: TranscribeOptions = {}): Transcription {
  const word = normalizeWord(rawWord);
  const parts = word.split(/[\s-]+/).filter(Boolean);

  if (parts.length > 1) {
    const transcribed = parts.map((p) => transcribe(p));
    const separators = [...word.matchAll(/[\s-]+/g)].map((m) => (m[0].includes('-') ? '-' : ' '));
    const ipa = transcribed
      .map((t) => t.ipa.replace(/^\/|\/$/g, ''))
      .reduce((acc, cur, i) => acc + (separators[i - 1] === '-' ? ' ' : ' ') + cur);
    const syllabification = transcribed
      .map((t) => t.syllabification)
      .reduce((acc, cur, i) => acc + (separators[i - 1] ?? '-') + cur);
    return {
      ipa: `/${ipa}/`,
      syllabification,
      stressedSyllable: 0,
      stressOrigin: 'derived',
      confidence: 'low',
    };
  }

  const phonemes: Phoneme[] = toPhonemes(word);
  const syllables = syllabify(phonemes);
  if (syllables.length === 0) {
    return {
      ipa: '//',
      syllabification: word,
      stressedSyllable: 0,
      stressOrigin: 'derived',
      confidence: 'low',
    };
  }

  const marked = options.stressMark ? stressedCharIndex(options.stressMark) : undefined;
  const stressed =
    marked !== undefined ? syllableOfChar(syllables, marked) : defaultStressSyllable(syllables);

  return {
    ipa: `/${renderIpa(syllables, stressed)}/`,
    syllabification: orthographicSyllables(word, syllables),
    stressedSyllable: stressed,
    stressOrigin: marked !== undefined ? 'attested' : 'derived',
    confidence: marked !== undefined ? 'high' : 'low',
  };
}
