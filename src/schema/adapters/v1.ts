import type { EntryV2, SenseNode } from '../entry-v2.js';
/**
 * v2 -> v1 adapter.
 *
 * `/v1` must keep its current response byte-for-byte, so this flattens the
 * recursive sense tree back into the flat list v1 clients expect:
 *
 *   - `meaning` and `sub-meaning` nodes become v1 senses, renumbered in
 *     depth-first order
 *   - `example` children collapse into the parent sense's `examples`
 *   - `expression` and `locution` children also collapse into `examples`,
 *     which is where the old parser put them
 *   - relations collapse into the parent's `synonyms`/`antonyms`; the typed
 *     diminutive/augmentative/hypernym lists have no v1 home and are dropped
 *   - `paradigm`, `derived`, `compounds`, `homonymIndex` and the extra source
 *     fields have no v1 home and are dropped
 *
 * Everything dropped here is still available on `/v2`.
 */
import type { Example, NormalizedEntry, Sense } from '../entry.js';

export function entryToV1(entry: EntryV2): NormalizedEntry {
  const senses = flattenSenses(entry.senses);

  const out: NormalizedEntry = {
    id: entry.id,
    headword: entry.headword,
    displayHeadword: entry.displayHeadword,
    partOfSpeech: entry.partOfSpeech,
    inflections: entry.inflections.map((i) => ({ form: i.form, tags: i.tags })),
    pronunciations: entry.pronunciations.map((p) => ({
      ...(p.ipa !== undefined ? { ipa: p.ipa } : {}),
      ...(p.syllabification !== undefined ? { syllabification: p.syllabification } : {}),
      ...(p.stressMark !== undefined ? { stressMark: p.stressMark } : {}),
      ...(p.audioUrl !== undefined ? { audioUrl: p.audioUrl } : {}),
      ...(p.audioMime !== undefined ? { audioMime: p.audioMime } : {}),
      ...(p.audioAttribution !== undefined ? { audioAttribution: p.audioAttribution } : {}),
    })),
    senses,
    source: {
      providerId: entry.source.providerId,
      providerName: entry.source.providerName,
      ...(entry.source.workTitle !== undefined
        ? { workTitle: entry.source.workTitle }
        : entry.source.sourceName !== undefined
          ? { workTitle: entry.source.sourceName }
          : {}),
      url: entry.source.url,
      license: entry.source.license,
      attribution: entry.source.attribution,
      fetchedAt: entry.source.fetchedAt,
      cacheHit: entry.source.cacheHit,
    },
  };

  if (entry.gender) out.gender = entry.gender;
  if (entry.etymology) out.etymology = entry.etymology;
  if (entry.paradigm?.classRoman) {
    out.conjugation = { classRoman: entry.paradigm.classRoman, forms: {} };
  }
  return out;
}

export function entriesToV1(entries: readonly EntryV2[]): NormalizedEntry[] {
  return entries.map(entryToV1);
}

/** Node types that become a v1 sense rather than an example of one. */
const SENSE_TYPES = new Set(['meaning', 'sub-meaning']);

function flattenSenses(nodes: readonly SenseNode[]): Sense[] {
  const out: Sense[] = [];

  const visit = (node: SenseNode): void => {
    if (!SENSE_TYPES.has(node.type)) return;

    const examples: Example[] = [];
    for (const child of node.children) {
      if (SENSE_TYPES.has(child.type)) continue;
      examples.push({
        text: child.text,
        ...(child.citation !== undefined ? { citation: child.citation } : {}),
      });
    }

    out.push({
      number: out.length + 1,
      text: node.text,
      register: node.register,
      ...(node.domain !== undefined ? { domain: node.domain } : {}),
      examples,
      synonyms: node.relations.synonyms,
      antonyms: node.relations.antonyms,
    });

    for (const child of node.children) {
      if (SENSE_TYPES.has(child.type)) visit(child);
    }
  };

  for (const node of nodes) visit(node);
  return out;
}
