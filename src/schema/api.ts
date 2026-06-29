import { z } from 'zod';
import { Capability, NormalizedEntry, ProviderId } from './entry.js';
import { ProviderError } from './errors.js';

const MAX_WORD_LENGTH = 64;
const ROMANIAN_HEADWORD = /^[\p{L}\p{M}'\-\s]+$/u;

export const HeadwordParam = z
  .string()
  .min(1)
  .max(MAX_WORD_LENGTH)
  .regex(ROMANIAN_HEADWORD, 'must contain only letters, hyphens, apostrophes, or spaces')
  .transform((v) => v.normalize('NFC').trim());
export type HeadwordParam = z.infer<typeof HeadwordParam>;

export const SourcesQuery = z
  .string()
  .optional()
  .transform((v): ProviderId[] | undefined => {
    if (!v) return undefined;
    const parts = v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.filter((p): p is ProviderId => ProviderId.safeParse(p).success);
  });

export const IncludeQuery = z
  .string()
  .optional()
  .transform((v): Capability[] | undefined => {
    if (!v) return undefined;
    const parts = v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.filter((p): p is Capability => Capability.safeParse(p).success);
  });

export const RefreshQuery = z
  .union([z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0')])
  .optional()
  .transform((v) => v === 'true' || v === '1');

/** Comma-separated dictionary names, e.g. ?dict=DEX '09,MDA2 */
const DictQuery = z
  .string()
  .optional()
  .transform((v) =>
    v
      ? v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined,
  );

const BooleanQuery = z
  .string()
  .optional()
  .transform((v) => (v === undefined ? undefined : v === '' || v === 'true' || v === '1'));

export const WordLookupQuery = z.object({
  sources: SourcesQuery,
  refresh: RefreshQuery,
  include: IncludeQuery,
  /** Return every entry, skipping ranking, deduplication and the cap. */
  all: BooleanQuery,
  /** Restrict to these contributing dictionaries. */
  dict: DictQuery,
  /** Cap on entries per provider. */
  limit: z.coerce.number().int().min(1).max(200).optional(),
  /** Include DOOM/Ortografic entries, which carry no definitions. */
  orthographic: BooleanQuery,
});

export const SearchQuery = z.object({
  q: z.string().min(1).max(MAX_WORD_LENGTH),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const WordLookupResponse = z.object({
  headword: z.string(),
  entries: z.array(NormalizedEntry),
  cache: z.object({
    hits: z.number().int().nonnegative(),
    misses: z.number().int().nonnegative(),
  }),
  errors: z.array(ProviderError),
});
export type WordLookupResponse = z.infer<typeof WordLookupResponse>;

export const SearchResultEntry = z.object({
  headword: z.string(),
  providerId: z.string(),
  preview: z.string(),
  score: z.number(),
});
export const SearchResponse = z.object({
  query: z.string(),
  count: z.number().int().nonnegative(),
  results: z.array(SearchResultEntry),
});
export type SearchResponse = z.infer<typeof SearchResponse>;

export const SourceInfo = z.object({
  id: ProviderId,
  name: z.string(),
  homepage: z.string().url(),
  license: z.string(),
  attribution: z.string(),
  capabilities: z.array(Capability),
  ttlSeconds: z.number(),
  enabled: z.boolean(),
  breakerState: z.enum(['closed', 'half-open', 'open']),
  rateLimitMs: z.number().int().nonnegative(),
});
export const SourcesResponse = z.object({
  sources: z.array(SourceInfo),
});

export const HealthResponse = z.object({
  status: z.enum(['ok', 'degraded']),
  uptime: z.number(),
  db: z.enum(['ok', 'error']),
  breakers: z.record(z.string(), z.enum(['closed', 'half-open', 'open'])),
});

export const AudioResponse = z.object({
  word: z.string(),
  pronunciations: z.array(
    z.object({
      audioUrl: z.string().url(),
      audioMime: z.string().optional(),
      audioAttribution: z.string().optional(),
    }),
  ),
  errors: z.array(ProviderError),
});

export const ConjugateResponse = z.object({
  verb: z.string(),
  classRoman: z.string().optional(),
  forms: z.record(z.string(), z.string()),
  source: z.enum(['seeded', 'rules']),
});

export const PluralizeResponse = z.object({
  singular: z.string(),
  plural: z.string(),
  gender: z.string().optional(),
});
