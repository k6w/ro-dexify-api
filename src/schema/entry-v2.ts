/**
 * v2 entry schema.
 *
 * v1's `Sense` is flat, which does not fit what the sources actually publish:
 * DEXonline nests locutions and sub-senses under a numbered sense (◊ and ♦),
 * ro.wiktionary hangs `#:` examples off a `#` sense, and both carry typed
 * relations (synonyms, diminutives, augmentatives) and per-sense provenance.
 * Flattening all of that on the way in loses information no later stage can
 * recover.
 *
 * `SenseNode` is a superset of v1's `Sense`, so a v1 sense is a valid leaf node
 * (`type: 'meaning'`, `children: []`). `src/schema/adapters/v1.ts` converts back
 * for the `/v1` routes, which keep their existing response shape.
 */
import { z } from 'zod';
import { Gender, PartOfSpeech } from './entry.js';

export { Gender, PartOfSpeech };

/**
 * What a node contributes. DEXonline's ◊ marks a locution and ♦ a sub-sense;
 * wiktionary's `#:` is an example; `expression` covers "Expr." blocks.
 */
export const SenseNodeType = z.enum([
  'meaning',
  'sub-meaning',
  'example',
  'expression',
  'locution',
  'etymology',
]);
export type SenseNodeType = z.infer<typeof SenseNodeType>;

export const SenseRelations = z.object({
  synonyms: z.array(z.string()).default([]),
  antonyms: z.array(z.string()).default([]),
  diminutives: z.array(z.string()).default([]),
  augmentatives: z.array(z.string()).default([]),
  hypernyms: z.array(z.string()).default([]),
});
export type SenseRelations = z.infer<typeof SenseRelations>;

/**
 * Optional fields are written `?: T | undefined` rather than `?: T` because the
 * project compiles with `exactOptionalPropertyTypes`, under which those two are
 * distinct — and zod's `.optional()` produces the former. Declaring `?: T` here
 * makes the schema below unassignable to this interface.
 */
export interface SenseNode {
  number?: number | undefined;
  text: string;
  type: SenseNodeType;
  register: string[];
  domain?: string | undefined;
  /** Bibliographic reference for an example, e.g. "STANCU, D. 19.". */
  citation?: string | undefined;
  /** Dictionaries that attest this node, e.g. ["DEX '09", "DLRLC"]. */
  sources: string[];
  relations: SenseRelations;
  children: SenseNode[];
}

// Input is `unknown`: fields carrying `.default()` are optional when parsing but
// always present after it, so the input and output types genuinely differ.
export const SenseNode: z.ZodType<SenseNode, z.ZodTypeDef, unknown> = z.lazy(() =>
  z.object({
    number: z.number().int().nonnegative().optional(),
    text: z.string().min(1),
    type: SenseNodeType.default('meaning'),
    register: z.array(z.string()).default([]),
    domain: z.string().optional(),
    citation: z.string().optional(),
    sources: z.array(z.string()).default([]),
    relations: SenseRelations.default({
      synonyms: [],
      antonyms: [],
      diminutives: [],
      augmentatives: [],
      hypernyms: [],
    }),
    children: z.array(SenseNode).default([]),
  }),
);

export const InflectionV2 = z.object({
  form: z.string().min(1),
  tags: z.array(z.string()).default([]),
  /**
   * 'attested' when the form came from a dictionary, 'derived' when a rule
   * engine produced it. Callers should prefer attested forms and may want to
   * hide low-confidence derived ones.
   */
  origin: z.enum(['attested', 'derived']).default('attested'),
  confidence: z.enum(['high', 'low']).default('high'),
});
export type InflectionV2 = z.infer<typeof InflectionV2>;

/** A full declension/conjugation table, when a source publishes one. */
export const Paradigm = z.object({
  /** DEXonline's inflection model, e.g. "I3" from /model-flexiune/I3. */
  modelCode: z.string().optional(),
  classRoman: z.string().optional(),
  cells: z
    .array(
      z.object({
        tags: z.array(z.string()).default([]),
        forms: z.array(z.string()).default([]),
      }),
    )
    .default([]),
});
export type Paradigm = z.infer<typeof Paradigm>;

export const PronunciationV2 = z.object({
  ipa: z.string().optional(),
  /** Lemma rewritten with an acute accent on the stressed vowel: "cásă". */
  stressMark: z.string().optional(),
  /** Zero-based index of the stressed vowel in the lemma. */
  stressIndex: z.number().int().nonnegative().optional(),
  syllabification: z.string().optional(),
  audioUrl: z.string().url().optional(),
  audioMime: z.string().optional(),
  audioAttribution: z.string().optional(),
});
export type PronunciationV2 = z.infer<typeof PronunciationV2>;

export const SourceCitationV2 = z.object({
  providerId: z.string(),
  providerName: z.string(),
  /** The contributing dictionary, e.g. "DEX '09". */
  sourceName: z.string().optional(),
  workTitle: z.string().optional(),
  /** 0-100; see src/providers/dexonline/rank.ts. */
  authority: z.number().min(0).max(100).default(50),
  year: z.number().int().optional(),
  url: z.string().url(),
  license: z.string(),
  attribution: z.string(),
  fetchedAt: z.string().datetime(),
  cacheHit: z.boolean(),
});
export type SourceCitationV2 = z.infer<typeof SourceCitationV2>;

export const EntryV2 = z.object({
  id: z.string().min(1),
  headword: z.string().min(1),
  displayHeadword: z.string().min(1),
  /** Homonym index where the source distinguishes them: casă^1 vs casă^2. */
  homonymIndex: z.number().int().positive().optional(),
  partOfSpeech: PartOfSpeech.default('unknown'),
  gender: Gender.optional(),
  inflections: z.array(InflectionV2).default([]),
  paradigm: Paradigm.optional(),
  pronunciations: z.array(PronunciationV2).default([]),
  senses: z.array(SenseNode).default([]),
  etymology: z
    .object({ text: z.string().min(1), languages: z.array(z.string()).default([]) })
    .optional(),
  /** Derived terms and compounds; never senses. */
  derived: z.array(z.string()).default([]),
  compounds: z.array(z.string()).default([]),
  source: SourceCitationV2,
});
export type EntryV2 = z.infer<typeof EntryV2>;

/** Empty relations object, for building nodes without repeating the shape. */
export function emptyRelations(): SenseRelations {
  return { synonyms: [], antonyms: [], diminutives: [], augmentatives: [], hypernyms: [] };
}

/** Build a leaf sense node with the boilerplate filled in. */
export function senseNode(text: string, init: Partial<Omit<SenseNode, 'text'>> = {}): SenseNode {
  return {
    text,
    type: init.type ?? 'meaning',
    register: init.register ?? [],
    sources: init.sources ?? [],
    relations: init.relations ?? emptyRelations(),
    children: init.children ?? [],
    ...(init.number !== undefined ? { number: init.number } : {}),
    ...(init.domain !== undefined ? { domain: init.domain } : {}),
    ...(init.citation !== undefined ? { citation: init.citation } : {}),
  };
}

/** Depth-first walk over a sense tree. */
export function* walkSenses(nodes: readonly SenseNode[]): Generator<SenseNode> {
  for (const node of nodes) {
    yield node;
    yield* walkSenses(node.children);
  }
}
