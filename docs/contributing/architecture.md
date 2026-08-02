# Architecture

## Layout

```
src/
  app.ts, index.ts        HTTP wiring and startup
  config.ts               env validation (zod)

  providers/              one directory per source
    base.ts               the shared lookup lifecycle
    types.ts              Provider, ProviderMeta
    registry.ts           the list of providers
    <name>/
      index.ts            metadata, URLs, hooks
      url.ts              URL construction
      parse.ts            bytes -> entries

  extract/                parsing primitives shared by providers
    abbrev.ts             Romanian grammatical abbreviations
    segment.ts            bracket-aware splitting
    internal-rep.ts       DEXonline's markup
    wikitext.ts           MediaWiki markup

  phonetics/              g2p.ts, syllabify.ts, index.ts
  tts/                    commons.ts, synthesize.ts, piper.ts, index.ts

  schema/
    entry.ts              v1 shape
    entry-v2.ts           v2 shape
    adapters/v1.ts        v2 -> v1
    adapters/lift.ts      v1 -> v2

  server/
    aggregator.ts         fan-out across providers
    view.ts               ranking, filtering, capping
    merge.ts              cross-provider merging
    routes/               one file per endpoint

  cache/                  sqlite.ts, memory.ts, ttl.ts, migrations/
  http/                   client, rate limit, circuit breaker, robots
  seed/                   the DEX dump importer
```

## Request flow

```
route → aggregator → provider.lookup ─┬─ memory cache
                                      ├─ sqlite cache
                                      ├─ robots → rate limit → breaker → fetch
                                      └─ parse
       ← applyView ← withDerivedPronunciations ← [mergeEntries] ← entriesToV1 (v1 only)
```

Two rules explain most of the design:

**Providers cache everything they parsed.** Ranking and filtering happen after
the cache in `view.ts`, because `lookups` is keyed on `(provider, headword)` and
a filtered result stored there would be served to a later unfiltered request.

**One provider's failure is contained.** The aggregator uses
`Promise.allSettled`; a failure becomes an entry in `errors` and the rest of the
response still arrives.

## The provider lifecycle

`BaseProvider.lookup` handles caching, robots, rate limiting, the breaker,
conditional requests and persistence. A provider supplies:

| Member | Required | Purpose |
|---|---|---|
| `meta` | yes | id, licence, capabilities, TTL, rate limit |
| `buildUrl(word)` | yes | Where to fetch |
| `parse(body, word)` | yes | Bytes → `EntryV2[]` |
| `extraHeaders()` | no | Extra request headers |
| `secondaryUrl(word)` | no | A second document to fetch |
| `mergeSecondary(entries, body)` | no | Fold it in |

`secondaryUrl` exists for DEXonline, which needs both the JSON API and the
rendered page. A secondary failure degrades to the primary result.

## v1 and v2

`EntryV2` is the real shape. `entriesToV1` flattens it for `/v1`, whose response
is frozen. Providers without nested structure build a flat entry and `liftEntry`
converts it, so they do not repeat the v2 boilerplate.

A round-trip test asserts `entryToV1(liftEntry(x)) === x` for a flat entry -
that is what guarantees `/v1` cannot change shape.

## Storage

The relational tables model v1's flat shape and back the FTS5 search index.
`entries.payload_json` holds the full v2 entry, because the tree, relations and
paradigm have no column to live in and a cache hit would otherwise silently
downgrade an entry.

Reads prefer the payload; rows written before that column existed fall back to
rebuilding from the relational tables.

## Conventions

- **No `any`.** `exactOptionalPropertyTypes` is on, so optional fields are
  written `?: T | undefined` where they must accept it.
- **Comments explain why, not what.** Several document a bug that a change
  fixed, so it does not come back.
- **Parsers never invent data.** A value that cannot be read is omitted, not
  guessed. Where a rule does produce a value, it is marked `derived`.
