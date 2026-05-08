# ro-dexify-api

Romanian-language dictionary aggregator API. Single TypeScript service with eight providers behind a unified, typed `NormalizedEntry` schema.

## Sources

| Provider | What it gives | Source |
|----------|---------------|--------|
| `doom` | Orthography, syllabification, inflections | https://doom.lingv.ro (DOOM 3) |
| `dexonline` | Definitions, etymology, examples | https://dexonline.ro (live + GPL SQL dump seed) |
| `mdex` | Definitions (mobile mirror) | https://m.dex.ro |
| `wiktionary` | Definitions, etymology, IPA | https://ro.wiktionary.org/w/api.php |
| `forvo` | Audio pronunciations | https://api.forvo.com (key required) |
| `dlr` | Academic definitions | https://dlr1.solirom.ro (env-gated) |
| `conjugare` | Verb conjugation (4-class rule engine; full-mode also seeds DEX `InflectedForm`) | local + DEX dump |
| `pluralro` | Noun pluralization | local rules |

## Setup

Cross-platform, Node-only — no MariaDB, no MySQL, no `sudo`.

```bash
pnpm install
pnpm bootstrap --lite     # filtered seed via embedded frequency list (~3 MB / ~8k senses with the default list)
pnpm bootstrap --full     # all entries from the dump (larger DB; covers the whole lexicon)
pnpm bootstrap --no-seed  # migrations only; live scraping fills cache on demand
pnpm dev
```

The dump (`dex-database.sql.gz`, ~370 MB compressed) is downloaded into `.cache/`, parsed in a stream, transformed into our SQLite schema, and the dump file is removed automatically (use `--keep-dump` to keep it). The dump and the SQLite database are gitignored.

**Lite vs full**:
- Lite filters by `src/seed/frequency-list.ts` (an embedded list, easy to extend). With the default short list it produces ~537 entries / 8,351 senses in ~3 MB and skips the `InflectedForm` table (the rule engine handles conjugation locally).
- Full imports every Entry/Definition for the allowlisted tables and seeds all inflected forms — DB grows to several hundred MB. Use this if you want offline coverage of the whole lexicon.

For words missing from the seed, the live `dexonline` provider fetches on demand (rate-limited per `robots.txt`), and the result is cached in the same SQLite tables.

## Endpoints (`/v1`)

```
GET  /v1/word/:word                  # aggregate all enabled providers
GET  /v1/word/:word/:source          # single provider
GET  /v1/audio/:word                 # Forvo passthrough
GET  /v1/conjugate/:verb             # rules + seeded forms
GET  /v1/pluralize/:noun             # rule-based pluralization
GET  /v1/search?q=&limit=&offset=    # FTS5 with diacritic-folding
GET  /v1/sources                     # provider metadata + breaker state
GET  /v1/healthz
GET  /openapi.json   /docs
```

JSON response shape (truncated):

```json
{
  "headword": "casă",
  "entries": [
    {
      "id": "...",
      "headword": "casă",
      "displayHeadword": "casă",
      "partOfSpeech": "substantiv",
      "gender": "feminin",
      "inflections": [{ "form": "case", "tags": ["plural"] }],
      "pronunciations": [{ "syllabification": "ca-să" }],
      "senses": [],
      "source": {
        "providerId": "doom",
        "providerName": "DOOM 3",
        "license": "CC-BY-NC-SA-4.0",
        "attribution": "...",
        "url": "https://doom.lingv.ro/cautare/q/cas%C4%83",
        "fetchedAt": "...",
        "cacheHit": false
      }
    }
  ],
  "cache": { "hits": 0, "misses": 1 },
  "errors": []
}
```

DOOM entries deliberately have empty `senses` — it's an orthography source, not semantic. Definitions come from `dexonline`, `mdex`, or `wiktionary`.

## Reliability

- Per-provider circuit breaker (cockatiel: 5 consecutive failures → open 60 s).
- Per-host token-bucket rate limit (e.g. dexonline 2 s, DOOM 1.5 s, Wiktionary 250 ms).
- robots.txt cached 24 h; disallowed paths return `[]`.
- `Promise.allSettled` fan-out: one slow source can't block the rest. Per-provider 8 s timeout, total budget 12 s.
- ETag / Last-Modified replay (304 → cache touch only).
- Output sanitised through `sanitize-html`; input validated with zod (max 64 chars, Romanian letters + `-`/`'` only).

## Configuration (`.env.example`)

```
PORT=3000
DB_PATH=./vocabulary.db
USER_AGENT="ro-dexify-api/2.0 (+https://github.com/k6w/ro-dexify-api; non-commercial)"
REQUEST_TIMEOUT_MS=8000
TOTAL_BUDGET_MS=12000
RATE_LIMIT_PER_MIN=60
ENABLE_DLR=false
FORVO_API_KEY=
FORVO_DAILY_QUOTA=500
DEX_DUMP_URL=https://dexonline.ro/static/download/dex-database.sql.gz
```

## Scripts

```
pnpm dev                run with hot reload (tsx watch)
pnpm build              compile to dist/
pnpm start              run compiled build
pnpm bootstrap [...]    cross-platform installer + seeder (avoids reserved `pnpm setup`)
pnpm seed               re-run bootstrap without `pnpm install`
pnpm fixtures:refresh   re-fetch test fixtures from live sources
pnpm test               vitest
pnpm typecheck          tsc --noEmit
pnpm lint               biome check
```

## Licensing & attribution

- DOOM 3: CC-BY-NC-SA 4.0. Non-commercial only. Attribution: Institutul de Lingvistică „Iorgu Iordan – Al. Rosetti".
- DEXonline: GPL data. Seed dump downloaded at setup; never committed.
- Wiktionary RO: CC-BY-SA 4.0.
- Forvo: proprietary; per-clip credit to user.
- DLR: academic source; cite Academia Română.

This project is non-commercial and open source (MIT). Per-provider attribution travels in every response in `entry.source.attribution`.
