import { z } from 'zod';

export const PartOfSpeech = z.enum([
  'substantiv',
  'adjectiv',
  'verb',
  'adverb',
  'pronume',
  'numeral',
  'prepoziție',
  'conjuncție',
  'interjecție',
  'articol',
  'locuțiune',
  'expresie',
  'unknown',
]);
export type PartOfSpeech = z.infer<typeof PartOfSpeech>;

export const Gender = z.enum(['masculin', 'feminin', 'neutru', 'comun']);
export type Gender = z.infer<typeof Gender>;

export const InflectionTag = z.string();

export const Inflection = z.object({
  form: z.string().min(1),
  tags: z.array(InflectionTag).default([]),
});
export type Inflection = z.infer<typeof Inflection>;

export const Conjugation = z.object({
  classRoman: z.string().optional(),
  forms: z.record(z.string(), z.string()).default({}),
});
export type Conjugation = z.infer<typeof Conjugation>;

export const Pronunciation = z.object({
  ipa: z.string().optional(),
  syllabification: z.string().optional(),
  stressMark: z.string().optional(),
  audioUrl: z.string().url().optional(),
  audioMime: z.string().optional(),
  audioAttribution: z.string().optional(),
});
export type Pronunciation = z.infer<typeof Pronunciation>;

export const Example = z.object({
  text: z.string().min(1),
  citation: z.string().optional(),
});
export type Example = z.infer<typeof Example>;

export const Sense = z.object({
  number: z.number().int().nonnegative().optional(),
  text: z.string().min(1),
  register: z.array(z.string()).default([]),
  domain: z.string().optional(),
  examples: z.array(Example).default([]),
  synonyms: z.array(z.string()).default([]),
  antonyms: z.array(z.string()).default([]),
});
export type Sense = z.infer<typeof Sense>;

export const Etymology = z.object({
  text: z.string().min(1),
  languages: z.array(z.string()).default([]),
});
export type Etymology = z.infer<typeof Etymology>;

export const SourceCitation = z.object({
  providerId: z.string(),
  providerName: z.string(),
  workTitle: z.string().optional(),
  url: z.string().url(),
  license: z.string(),
  attribution: z.string(),
  fetchedAt: z.string().datetime(),
  cacheHit: z.boolean(),
});
export type SourceCitation = z.infer<typeof SourceCitation>;

export const NormalizedEntry = z.object({
  id: z.string().min(1),
  headword: z.string().min(1),
  displayHeadword: z.string().min(1),
  partOfSpeech: PartOfSpeech.default('unknown'),
  gender: Gender.optional(),
  inflections: z.array(Inflection).default([]),
  conjugation: Conjugation.optional(),
  pronunciations: z.array(Pronunciation).default([]),
  senses: z.array(Sense).default([]),
  etymology: Etymology.optional(),
  source: SourceCitation,
});
export type NormalizedEntry = z.infer<typeof NormalizedEntry>;

export const ProviderId = z.enum([
  'doom',
  'dexonline',
  'mdex',
  'wiktionary',
  'forvo',
  'dlr',
  'conjugare',
  'pluralro',
]);
export type ProviderId = z.infer<typeof ProviderId>;

export const Capability = z.enum([
  'definitions',
  'etymology',
  'pronunciation_text',
  'pronunciation_audio',
  'inflections',
  'conjugation',
  'pluralization',
  'examples',
  'register_notes',
]);
export type Capability = z.infer<typeof Capability>;
