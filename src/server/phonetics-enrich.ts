import { transcribe } from '../phonetics/index.js';
/**
 * Attach a derived transcription to entries that have none.
 *
 * Only DOOM and DEXonline mark stress, and only Wiktionary publishes IPA — for
 * most words, from most providers, an entry arrives with an empty
 * `pronunciations`. Romanian spelling is regular enough to transcribe, so this
 * fills the gap from src/phonetics.
 *
 * Two rules keep it honest:
 *   - an attested transcription is never overwritten. If Wiktionary gave IPA,
 *     that stands; the derived one is not added alongside it.
 *   - a stress mark from DOOM or DEXonline is used to place the accent, so the
 *     result is `attested` where a dictionary really said so and `derived`
 *     where the regular pattern was assumed.
 */
import type { EntryV2, PronunciationV2 } from '../schema/entry-v2.js';

export function withDerivedPronunciation(entry: EntryV2): EntryV2 {
  const hasIpa = entry.pronunciations.some((p) => p.ipa);
  if (hasIpa) return entry;

  // Reuse whatever stress a dictionary already established for this entry.
  const stressMark = entry.pronunciations.find((p) => p.stressMark)?.stressMark;

  let transcription: ReturnType<typeof transcribe>;
  try {
    transcription = transcribe(entry.displayHeadword, stressMark ? { stressMark } : {});
  } catch {
    return entry;
  }
  if (!transcription.ipa || transcription.ipa === '//') return entry;

  const derived: PronunciationV2 = {
    ipa: transcription.ipa,
    ...(transcription.syllabification.includes('-')
      ? { syllabification: transcription.syllabification }
      : {}),
    ...(stressMark ? { stressMark } : {}),
  };

  // Merge into an existing pronunciation rather than adding a second entry that
  // says the same thing about the same word.
  const existing = entry.pronunciations[0];
  if (existing && !existing.ipa) {
    return {
      ...entry,
      pronunciations: [{ ...existing, ...derived }, ...entry.pronunciations.slice(1)],
    };
  }
  return { ...entry, pronunciations: [...entry.pronunciations, derived] };
}

export function withDerivedPronunciations(entries: readonly EntryV2[]): EntryV2[] {
  return entries.map(withDerivedPronunciation);
}
