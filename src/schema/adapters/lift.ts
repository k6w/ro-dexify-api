import type { EntryV2, InflectionV2, SenseNode } from '../entry-v2.js';
import { emptyRelations } from '../entry-v2.js';
/**
 * v1 -> v2 lift.
 *
 * Providers that have no nested structure to express (forvo, dlr, pluralro,
 * conjugare, and the DEX dump seeder) build a flat entry and lift it here,
 * rather than each repeating the v2 boilerplate. Providers with real structure
 * — dexonline's ◊/♦ nesting, wiktionary's `#:` examples — build `EntryV2`
 * directly so nothing is flattened on the way in.
 *
 * This is lossless in the v1 -> v2 direction: every v1 field has a v2 home.
 */
import type { NormalizedEntry, Sense } from '../entry.js';

/**
 * A v1 entry that also knows its homonym index.
 *
 * v1's NormalizedEntry has no field for it, but a provider building a flat
 * entry may still have parsed one (m.dex.ro fuses it onto the headword). Rather
 * than lose it on the way to v2, it is read off the input when present.
 */
type LiftableEntry = NormalizedEntry & { homonymIndex?: number };

export interface LiftOptions {
  /** 0-100 source authority; defaults to the neutral 50. */
  authority?: number;
  /** Contributing dictionary, when the provider aggregates several. */
  sourceName?: string;
  /** Mark forms as rule-derived rather than attested in a dictionary. */
  origin?: InflectionV2['origin'];
  confidence?: InflectionV2['confidence'];
}

export function liftSense(sense: Sense): SenseNode {
  const children: SenseNode[] = sense.examples.map((ex) => ({
    text: ex.text,
    type: 'example' as const,
    register: [],
    sources: [],
    relations: emptyRelations(),
    children: [],
    ...(ex.citation !== undefined ? { citation: ex.citation } : {}),
  }));

  return {
    text: sense.text,
    type: 'meaning',
    register: sense.register,
    sources: [],
    relations: {
      ...emptyRelations(),
      synonyms: sense.synonyms,
      antonyms: sense.antonyms,
    },
    children,
    ...(sense.number !== undefined ? { number: sense.number } : {}),
    ...(sense.domain !== undefined ? { domain: sense.domain } : {}),
  };
}

export function liftEntry(entry: LiftableEntry, opts: LiftOptions = {}): EntryV2 {
  const out: EntryV2 = {
    id: entry.id,
    headword: entry.headword,
    displayHeadword: entry.displayHeadword,
    partOfSpeech: entry.partOfSpeech,
    inflections: entry.inflections.map((i) => ({
      form: i.form,
      tags: i.tags,
      origin: opts.origin ?? 'attested',
      confidence: opts.confidence ?? 'high',
    })),
    pronunciations: entry.pronunciations.map((p) => ({ ...p })),
    senses: entry.senses.map(liftSense),
    derived: [],
    compounds: [],
    source: {
      providerId: entry.source.providerId,
      providerName: entry.source.providerName,
      authority: opts.authority ?? 50,
      ...(opts.sourceName !== undefined
        ? { sourceName: opts.sourceName }
        : entry.source.workTitle !== undefined
          ? { sourceName: entry.source.workTitle }
          : {}),
      ...(entry.source.workTitle !== undefined ? { workTitle: entry.source.workTitle } : {}),
      url: entry.source.url,
      license: entry.source.license,
      attribution: entry.source.attribution,
      fetchedAt: entry.source.fetchedAt,
      cacheHit: entry.source.cacheHit,
    },
  };

  if (entry.gender) out.gender = entry.gender;
  if (entry.homonymIndex !== undefined) out.homonymIndex = entry.homonymIndex;
  if (entry.etymology) out.etymology = entry.etymology;
  if (entry.conjugation) {
    out.paradigm = {
      cells: Object.entries(entry.conjugation.forms).map(([key, form]) => ({
        tags: [key],
        forms: [form],
      })),
      ...(entry.conjugation.classRoman !== undefined
        ? { classRoman: entry.conjugation.classRoman }
        : {}),
    };
  }
  return out;
}

export function liftEntries(entries: readonly LiftableEntry[], opts: LiftOptions = {}): EntryV2[] {
  return entries.map((e) => liftEntry(e, opts));
}
