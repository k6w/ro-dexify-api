/**
 * Cross-provider entry merging.
 *
 * Without it a lookup for "casă" returns four parallel entries for the same
 * word: DOOM has the stress and inflections but no senses, DEXonline has the
 * senses but no inflections, Wiktionary has the IPA and the declension, and
 * pluralro has a derived plural. Merging groups them by (lemma, homonym, part
 * of speech) so a client sees one word with everything known about it.
 *
 * Opt-in via `?merge`, because the unmerged view is what existing clients get
 * and is still the right shape when you care which source said what.
 *
 * Provenance is preserved: the merged entry keeps the highest-authority source
 * as its own, and `contributors` lists every provider that fed into it.
 */
import type { EntryV2, InflectionV2, PronunciationV2, SenseNode } from '../schema/entry-v2.js';

export interface MergedEntry extends EntryV2 {
  /** Provider ids that contributed to this entry, highest authority first. */
  contributors: string[];
}

function lemmaKey(entry: EntryV2): string {
  const lemma = entry.headword.normalize('NFC').toLocaleLowerCase('ro-RO');
  // Entries with an unknown part of speech merge into whatever else matches the
  // lemma rather than forming a group of their own.
  const pos = entry.partOfSpeech === 'unknown' ? '' : entry.partOfSpeech;
  return `${lemma}|${pos}`;
}

/**
 * Assign every entry to a group.
 *
 * Homonyms stay apart — casă¹ (building) and casă² (cash register) are
 * different words — but only DEXonline publishes a homonym index. DOOM,
 * Wiktionary and the rule providers do not, so an index-less entry joins the
 * lowest-numbered homonym for its lemma. Without that, DOOM's stress and
 * inflections never reached the DEXonline senses they belong to.
 */
function groupEntries(entries: readonly EntryV2[]): Map<string, EntryV2[]> {
  const lowestIndex = new Map<string, number>();
  for (const entry of entries) {
    if (entry.homonymIndex === undefined) continue;
    const key = lemmaKey(entry);
    const current = lowestIndex.get(key);
    if (current === undefined || entry.homonymIndex < current) {
      lowestIndex.set(key, entry.homonymIndex);
    }
  }

  const groups = new Map<string, EntryV2[]>();
  for (const entry of entries) {
    const base = lemmaKey(entry);
    const index = entry.homonymIndex ?? lowestIndex.get(base) ?? 1;
    const key = `${base}|${index}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(entry);
    else groups.set(key, [entry]);
  }
  return groups;
}

function dedupeInflections(items: readonly InflectionV2[]): InflectionV2[] {
  const seen = new Map<string, InflectionV2>();
  for (const item of items) {
    const key = `${item.form}|${[...item.tags].sort().join(',')}`;
    const existing = seen.get(key);
    // An attested form always beats a rule-derived one.
    if (!existing || (existing.origin === 'derived' && item.origin === 'attested')) {
      seen.set(key, item);
    }
  }
  return [...seen.values()];
}

function dedupePronunciations(items: readonly PronunciationV2[]): PronunciationV2[] {
  const seen = new Map<string, PronunciationV2>();
  for (const item of items) {
    // Key on the transcription itself. Keying on the whole object made the same
    // IPA appear once per contributing provider, because DOOM writes the stress
    // mark "cásă" and DEXonline "CÁSĂ" — different objects, identical sound.
    const key = item.ipa ?? item.audioUrl ?? item.stressMark ?? JSON.stringify(item);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, item);
      continue;
    }
    // Keep the richest version: later providers may add syllabification or
    // audio the first one lacked.
    seen.set(key, { ...item, ...existing, ...stripUndefined(item) });
  }
  return [...seen.values()];
}

function stripUndefined(p: PronunciationV2): PronunciationV2 {
  return Object.fromEntries(
    Object.entries(p).filter(([, v]) => v !== undefined),
  ) as PronunciationV2;
}

function senseKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupeSenses(items: readonly SenseNode[]): SenseNode[] {
  const seen = new Set<string>();
  const out: SenseNode[] = [];
  for (const node of items) {
    const key = senseKey(node.text);
    if (key.length > 12 && seen.has(key)) continue;
    if (key.length > 12) seen.add(key);
    out.push({ ...node, number: out.length + 1 });
  }
  return out;
}

/**
 * Merge entries that describe the same word.
 *
 * Order within a group is by descending source authority, so the most
 * authoritative entry supplies the scalar fields (part of speech, gender,
 * etymology) and the rest contribute lists.
 */
export function mergeEntries(entries: readonly EntryV2[]): MergedEntry[] {
  const groups = groupEntries(entries);

  const out: MergedEntry[] = [];
  for (const bucket of groups.values()) {
    const sorted = [...bucket].sort((a, b) => b.source.authority - a.source.authority);
    const primary = sorted[0];
    if (!primary) continue;

    if (sorted.length === 1) {
      out.push({ ...primary, contributors: [primary.source.providerId] });
      continue;
    }

    const merged: MergedEntry = {
      ...primary,
      // The first entry that actually knows the part of speech wins; DOOM often
      // does when DEXonline's grammatical preamble is ambiguous.
      partOfSpeech:
        sorted.find((e) => e.partOfSpeech !== 'unknown')?.partOfSpeech ?? primary.partOfSpeech,
      inflections: dedupeInflections(sorted.flatMap((e) => e.inflections)),
      pronunciations: dedupePronunciations(sorted.flatMap((e) => e.pronunciations)),
      senses: dedupeSenses(sorted.flatMap((e) => e.senses)),
      derived: [...new Set(sorted.flatMap((e) => e.derived))],
      compounds: [...new Set(sorted.flatMap((e) => e.compounds))],
      contributors: [...new Set(sorted.map((e) => e.source.providerId))],
    };

    const gender = sorted.find((e) => e.gender)?.gender;
    if (gender) merged.gender = gender;
    const etymology = sorted.find((e) => e.etymology)?.etymology;
    if (etymology) merged.etymology = etymology;
    const paradigm = sorted.find((e) => e.paradigm)?.paradigm;
    if (paradigm) merged.paradigm = paradigm;

    out.push(merged);
  }

  return out.sort((a, b) => b.source.authority - a.source.authority);
}
