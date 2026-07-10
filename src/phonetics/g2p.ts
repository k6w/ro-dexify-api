/**
 * Romanian grapheme-to-phoneme conversion.
 *
 * Romanian orthography is close to phonemic, so transcription is a rule problem
 * rather than a lexicon problem: given the spelling, the pronunciation is
 * almost always derivable. That matters here because Wiktionary publishes IPA
 * for only a small fraction of the lexicon — of the eight words recorded as
 * fixtures it has usable Romanian IPA for five — while this produces a
 * transcription for every word, and feeds the TTS layer phonemes instead of
 * letting the synthesiser guess at Romanian spelling.
 *
 * Output is verified against the IPA those fixtures do carry; see
 * tests/phonetics/g2p.test.ts.
 *
 * The rules that actually decide correctness:
 *   c, g   -> t͡ʃ, d͡ʒ before e/i, otherwise k, ɡ
 *   ch, gh -> k, ɡ  (the h is a diacritic, never a sound)
 *   ce/ci, ge/gi before another vowel: the i is a marker, not a vowel
 *          ("ciocolată" is t͡ʃo-, not t͡ʃio-)
 *   ea, oa -> e̯a, o̯a   (rising diphthongs, one syllable)
 *   i, e, o, u before a vowel -> the glides j, w
 *   word-final -i after a consonant is non-syllabic: "lupi" is /lupʲ/
 */

export type PhonemeRole = 'vowel' | 'semivowel' | 'consonant';

export interface Phoneme {
  ipa: string;
  role: PhonemeRole;
  /** Index of the grapheme that produced it, for stress mapping. */
  source: number;
}

const VOWEL_LETTERS = new Set(['a', 'ă', 'â', 'e', 'i', 'î', 'o', 'u']);

const VOWELS: Record<string, string> = {
  a: 'a',
  ă: 'ə',
  â: 'ɨ',
  î: 'ɨ',
  e: 'e',
  i: 'i',
  o: 'o',
  u: 'u',
};

const CONSONANTS: Record<string, string> = {
  b: 'b',
  c: 'k',
  d: 'd',
  f: 'f',
  g: 'ɡ',
  h: 'h',
  j: 'ʒ',
  k: 'k',
  l: 'l',
  m: 'm',
  n: 'n',
  p: 'p',
  q: 'k',
  r: 'r',
  s: 's',
  ș: 'ʃ',
  t: 't',
  ț: 't͡s',
  v: 'v',
  w: 'v',
  x: 'ks',
  y: 'i',
  z: 'z',
};

/** Glide produced when these vowels precede another vowel. */
const GLIDES: Record<string, string> = { i: 'j', e: 'e̯', o: 'o̯', u: 'w' };

/**
 * Words whose initial `e` is pronounced /je/. A closed, well-known list — the
 * personal pronouns and the forms of "a fi". Everywhere else initial `e` is /e/.
 */
const INITIAL_JE = new Set([
  'eu',
  'el',
  'ea',
  'ei',
  'ele',
  'este',
  'esti',
  'ești',
  'eram',
  'erai',
  'era',
  'erați',
  'erau',
  'e',
]);

export function normalizeWord(word: string): string {
  return word
    .normalize('NFC')
    .toLocaleLowerCase('ro-RO')
    .replace(/ş/g, 'ș')
    .replace(/ţ/g, 'ț')
    .trim();
}

function isVowelLetter(ch: string | undefined): boolean {
  return ch !== undefined && VOWEL_LETTERS.has(ch);
}

/**
 * Convert one orthographic word to a phoneme sequence.
 *
 * Multi-word input (hyphenated or spaced compounds) should be split by the
 * caller; `transcribe()` does that.
 */
export function toPhonemes(rawWord: string): Phoneme[] {
  const w = normalizeWord(rawWord);
  const out: Phoneme[] = [];
  const forceInitialJe = INITIAL_JE.has(w);

  let i = 0;
  while (i < w.length) {
    const ch = w[i];
    if (!ch) break;
    const next = w[i + 1];
    const after = w[i + 2];
    const push = (ipa: string, role: PhonemeRole, consumed: number): void => {
      out.push({ ipa, role, source: i });
      i += consumed;
    };

    // ch / gh are digraphs for plain k / ɡ; the h is never pronounced.
    if ((ch === 'c' || ch === 'g') && next === 'h') {
      push(ch === 'c' ? 'k' : 'ɡ', 'consonant', after === 'e' || after === 'i' ? 2 : 2);
      continue;
    }

    // c/g before e or i are affricates. When a further vowel follows, that e/i
    // is only the softening marker and contributes no sound of its own.
    if ((ch === 'c' || ch === 'g') && (next === 'e' || next === 'i')) {
      const affricate = ch === 'c' ? 't͡ʃ' : 'd͡ʒ';
      if (isVowelLetter(after)) {
        push(affricate, 'consonant', 2);
        continue;
      }
      push(affricate, 'consonant', 1);
      continue;
    }

    if (isVowelLetter(ch)) {
      const isFirst = out.length === 0;

      if (ch === 'e' && isFirst && forceInitialJe) {
        out.push({ ipa: 'j', role: 'semivowel', source: i });
        push('e', 'vowel', 1);
        continue;
      }

      const prevPhoneme = out[out.length - 1];

      // Falling diphthong: a close vowel AFTER a nucleus is the glide.
      // "ou" is /ow/ and "lui" is /luj/ -- treating the first vowel as the
      // glide instead gave /o̯u/. Identical vowels are hiatus, not a diphthong,
      // so "știință" stays /ʃti.in.t͡sə/.
      if (
        (ch === 'i' || ch === 'u') &&
        prevPhoneme?.role === 'vowel' &&
        w[i - 1] !== ch &&
        !isVowelLetter(next)
      ) {
        push(ch === 'i' ? 'j' : 'w', 'semivowel', 1);
        continue;
      }

      // Rising diphthong: a vowel before an OPEN vowel becomes the glide --
      // ea -> e̯a, oa -> o̯a, ia -> ja, ie -> je. Requiring an open vowel is
      // what keeps "ou" and "ui" out of this branch.
      const nextIsOpen = next !== undefined && /[aăâeo]/.test(next);
      const risingPair = nextIsOpen || (ch === 'i' && next === 'u');
      if (isVowelLetter(next) && next !== ch && risingPair && GLIDES[ch] !== undefined) {
        const glide = GLIDES[ch];
        if (glide !== undefined) {
          push(glide, 'semivowel', 1);
          continue;
        }
      }

      const vowel = VOWELS[ch];
      if (vowel !== undefined) {
        // Word-final -i after a consonant is not a syllable: it palatalises.
        const isFinal = i === w.length - 1;
        const prev = out[out.length - 1];
        if (ch === 'i' && isFinal && prev?.role === 'consonant') {
          push('ʲ', 'semivowel', 1);
          continue;
        }
        push(vowel, 'vowel', 1);
        continue;
      }
      i += 1;
      continue;
    }

    const cons = CONSONANTS[ch];
    if (cons !== undefined) {
      push(cons, 'consonant', 1);
      continue;
    }
    i += 1;
  }

  return out;
}

/** True when a phoneme can be a syllable nucleus. */
export function isNucleus(p: Phoneme): boolean {
  return p.role === 'vowel';
}

/** Render a phoneme sequence to a bare IPA string, no syllables or stress. */
export function renderPhonemes(phonemes: readonly Phoneme[]): string {
  return phonemes.map((p) => p.ipa).join('');
}
