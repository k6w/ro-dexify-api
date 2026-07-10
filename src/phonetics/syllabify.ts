/**
 * Romanian syllabification, over phonemes rather than letters.
 *
 * Working on phonemes avoids the traps that catch letter-based splitters:
 * "ch"/"gh" are single sounds, "ea"/"oa" are one syllable, and a final "-i"
 * after a consonant is not a syllable at all.
 *
 * The rules (as taught, and as DOOM applies them):
 *   V-CV      one consonant between vowels joins the following syllable
 *   VC-CV     two consonants split, EXCEPT muta cum liquida — a stop or
 *             fricative followed by l/r stays together ("ta-blou", not "tab-lou")
 *   VC-CCV    three or more: the first joins the preceding syllable
 *
 * Semivowels attach to the nucleus they glide into (before it) or off (after).
 */
import type { Phoneme } from './g2p.js';

/** Stops and fricatives that keep a following l/r in the same syllable. */
const MUTA = new Set(['p', 'b', 't', 'd', 'k', 'ɡ', 'f', 'v', 'h']);
const LIQUIDA = new Set(['l', 'r']);

function isMutaCumLiquida(a: string | undefined, b: string | undefined): boolean {
  return a !== undefined && b !== undefined && MUTA.has(a) && LIQUIDA.has(b);
}

export interface Syllable {
  phonemes: Phoneme[];
  /** Index into the phoneme array of this syllable's vowel. */
  nucleusIndex: number;
}

export function syllabify(phonemes: readonly Phoneme[]): Syllable[] {
  const nuclei: number[] = [];
  phonemes.forEach((p, i) => {
    if (p.role === 'vowel') nuclei.push(i);
  });
  if (nuclei.length === 0) {
    return phonemes.length > 0 ? [{ phonemes: [...phonemes], nucleusIndex: 0 }] : [];
  }

  // Choose a split point in the consonant run between each pair of nuclei.
  const boundaries: number[] = [];
  for (let n = 0; n < nuclei.length - 1; n++) {
    const left = nuclei[n];
    const right = nuclei[n + 1];
    if (left === undefined || right === undefined) continue;

    // Consonants strictly between the two nuclei; semivowels stay with their
    // nucleus and never take part in the split.
    const between: number[] = [];
    for (let i = left + 1; i < right; i++) {
      const p = phonemes[i];
      if (p?.role === 'consonant') between.push(i);
    }

    const first = between[0];
    const second = between[1];

    if (between.length === 0) {
      // No consonant between the nuclei. A semivowel there is the onset of the
      // following syllable, so the split goes before it: "oaie" is o̯a-je, not
      // o̯aj-e. With nothing between at all it is plain hiatus.
      let semivowel = -1;
      for (let i = left + 1; i < right; i++) {
        if (phonemes[i]?.role === 'semivowel') {
          semivowel = i;
          break;
        }
      }
      boundaries.push(semivowel >= 0 ? semivowel : right);
    } else if (between.length === 1 && first !== undefined) {
      boundaries.push(first);
    } else if (between.length === 2 && first !== undefined && second !== undefined) {
      boundaries.push(
        isMutaCumLiquida(phonemes[first]?.ipa, phonemes[second]?.ipa) ? first : second,
      );
    } else if (second !== undefined) {
      boundaries.push(second);
    }
  }

  const syllables: Syllable[] = [];
  let start = 0;
  for (const b of [...boundaries, phonemes.length]) {
    const slice = phonemes.slice(start, b);
    if (slice.length === 0) continue;
    const nucleusIndex = slice.findIndex((p) => p.role === 'vowel');
    syllables.push({ phonemes: slice, nucleusIndex: nucleusIndex >= 0 ? nucleusIndex : 0 });
    start = b;
  }

  // A trailing consonant-only run (e.g. the palatal glide in "lupʲ") belongs to
  // the last real syllable, not to one of its own.
  if (syllables.length > 1) {
    const last = syllables[syllables.length - 1];
    if (last && !last.phonemes.some((p) => p.role === 'vowel')) {
      const prev = syllables[syllables.length - 2];
      if (prev) {
        prev.phonemes.push(...last.phonemes);
        syllables.pop();
      }
    }
  }

  return syllables;
}
