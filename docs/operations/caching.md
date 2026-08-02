# Caching

Four layers. Understanding them explains most latency questions.

## The layers

| Layer | Scope | Lifetime | Cleared by |
|---|---|---|---|
| Memory (LRU) | Per provider + word | 5 min | Restart |
| SQLite `lookups` | Per provider + word | Per-provider TTL | `?refresh`, deleting the DB |
| HTTP validators | ETag / Last-Modified | Until upstream changes |: |
| Audio files | `.cache/tts/` | Forever | `rm -rf .cache/tts` |

Per-provider TTLs are listed in [Sources](../sources/README.md#cache-lifetimes) -
30 days for DOOM, 7 for DEXonline, 3 for Wiktionary, a year for the local ones.

## A lookup, step by step

1. **Memory**: hit? return.
2. **SQLite**: row present and unexpired? return.
3. **robots.txt** (cached 24 h): disallowed? provider error.
4. **Rate limit**: wait for this host's turn.
5. **Circuit breaker**: open? skip the provider.
6. **Fetch**, sending `If-None-Match` / `If-Modified-Since` if a copy exists.
   A `304` refreshes the TTL without re-parsing.
7. **Parse**, store, return.

## Filtering happens after the cache

This is the important design point. `?dict`, `?all`, `?limit`, `?orthographic`
and `?merge` shape the **response**, not what is fetched or stored.

The `lookups` table is keyed on `(provider, headword)` only. If a filtered
request stored its narrow result, the next unfiltered request would be served
those few entries from cache. So providers cache everything they parsed, and
filtering runs on the way out:

```
?dict=DEX '09  →  2 entries   (2 fetches)
unfiltered     →  8 entries   (0 fetches)
?all           → 28 entries   (0 fetches)
```

One upstream fetch serves every view. Filtering costs nothing.

## `cache` in the response

```json
"cache": { "hits": 8, "misses": 0 }
```

Counted per **entry**, not per request. Eight entries from one cached provider
lookup is `hits: 8`.

## Audio cache

Keyed by word **and** voice, so the same word in two voices is two files.

```bash
rm -rf .cache/tts     # safe; regenerates on demand
```

## What to expect

| Situation | Latency |
|---|---|
| Memory hit | ~1 ms |
| SQLite hit | ~5 ms |
| DEXonline miss | ~2.5 s (two requests, 2 s apart) |
| Other provider miss | 0.3–2 s |
| espeak synthesis | ~200 ms first time, then cached |

If everything feels slow, look for an open circuit breaker in
[`/v1/sources`](../api/sources.md).

## Resetting

```bash
rm -f vocabulary.db*        # all cached words and the search index
rm -rf .cache/tts           # audio only
pnpm bootstrap --lite       # rebuild
```
