# ro-dexify-api

Romanian dictionary API. One TypeScript service that reads several dictionaries, normalises them into
a single typed entry, and serves definitions, inflections, etymology, IPA and pronunciation audio.

Every parser is tested against **recorded responses from the live sites** (`tests/fixtures/`), and a
nightly job re-runs them against the real upstreams so a redesign is caught before users are.

Every example below is real output from the running service, not an illustration.

## Quickstart

```bash
pnpm install
pnpm bootstrap --lite     # migrations + a filtered seed from the GPL DEX dump (~3 MB)
pnpm dev
```

`pnpm bootstrap --no-seed` runs migrations only; live lookups then fill the cache on demand. No
MariaDB, no MySQL, no `sudo` — Node and SQLite only.

## Sources

| Provider | What it actually provides | Status |
|---|---|---|
| `doom` | Orthography, **stress**, syllabification, inflections, verb paradigms | on |
| `dexonline` | Definitions, sense tree, etymology, synonyms/diminutives, cited examples, full declension | on |
| `wiktionary` | Definitions, etymology, IPA, declension/conjugation templates | on |
| `conjugare` | Verb conjugation — 22 irregular verbs by table, plus a 4-class rule engine | on (local) |
| `pluralro` | Rule-based pluralisation | on (local) |
| `mdex` | Definitions — mirrors the same DEXonline corpus in poorer markup | **off by default** (`?sources=mdex`) |
| `forvo` | Audio pronunciations | off unless `FORVO_API_KEY` is set |
| `dlr` | Academic definitions | **unavailable** — see below |

`dlr1.solirom.ro/index.php?cuv=<word>` returns HTTP 404 for every word. The site was rebuilt as a
browser-only application that resolves words client-side, so there is no server-rendered page to
fetch. The provider is disabled unconditionally rather than left to fail on every request.

**DEXonline makes two requests per cache miss**: the JSON API for definitions, then the rendered page
2 s later (its `robots.txt` sets `Crawl-delay: 2`) for relations, cited examples and the declension
table. Cold lookups take ~2.5 s; both documents land in one cache entry, so cache hits cost nothing
extra. If the second request fails, the JSON result is still returned.

## Endpoints

```
GET  /v1/word/:word                  aggregate across enabled providers (flat senses)
GET  /v1/word/:word/:source          single provider
GET  /v2/word/:word                  same lookup, full entry (recursive sense tree)
GET  /v2/word/:word/:source
GET  /v1/tts/:word                   pronunciation audio
GET  /v1/search?q=&limit=&offset=    FTS5 over cached entries, diacritic-folded
GET  /v1/conjugate/:verb
GET  /v1/pluralize/:noun
GET  /v1/audio/:word                 Forvo passthrough (needs a key)
GET  /v1/sources                     provider metadata + circuit-breaker state
GET  /v1/healthz
GET  /openapi.json   /docs
```

### `/v1` vs `/v2`

`/v1` is frozen: senses are a flat list, and its response shape has not changed. `/v2` returns the
entry as the providers built it — a recursive sense tree with typed nodes (`meaning`, `sub-meaning`,
`example`, `expression`, `locution`), per-sense `relations` and `sources`, `paradigm`,
`homonymIndex`, inflection `origin`/`confidence`, and `source.authority`. `/v1` is produced from
`/v2` by a flattening adapter.

Only `/word` is versioned. `search`, `tts`, `conjugate`, `pluralize`, `sources` and `healthz` are
shared and live under `/v1`.

### Query parameters (`/word`, both versions)

| Parameter | Effect |
|---|---|
| `?sources=doom,dexonline` | restrict to these providers |
| `?refresh` | bypass the cache |
| `?all` | skip ranking, deduplication and the cap |
| `?dict=DEX '09,MDA2` | restrict to these contributing dictionaries |
| `?limit=N` | cap entries per provider (default 8) |
| `?orthographic` | include DOOM/Ortografic entries, which carry inflection but no definitions |
| `?merge` | combine providers describing the same word into one entry |

A lookup for `casă` draws on 32 dictionaries and 120 DEXonline definitions, so the default response
is ranked by source authority (DOOM 3, DEX '09, DEXI, MDA2 high; Scriban 1939, Șăineanu 1929 low),
deduplicated and capped.

**Ranking and filtering run after the cache.** One upstream fetch serves every view, and a
`?dict`-filtered request cannot poison an unfiltered one:

```
?dict=DEX '09  →  2 entries   (2 misses)
unfiltered     →  8 entries   (8 cache hits)
?all=true      → 28 entries   (28 cache hits)
```

### Example

`GET /v1/word/casă?sources=doom`

```json
{
  "id": "3616fe0c09939afac183e85967",
  "headword": "casă",
  "displayHeadword": "casă",
  "partOfSpeech": "substantiv",
  "inflections": [
    { "form": "casei", "tags": ["genitive", "dative", "articulated"] },
    { "form": "case",  "tags": ["plural"] }
  ],
  "pronunciations": [
    { "ipa": "/ˈka.sə/", "syllabification": "ca-să", "stressMark": "cásă" }
  ],
  "senses": []
}
```

DOOM entries have empty `senses` by design — it is an orthographic dictionary. Definitions come from
`dexonline` and `wiktionary`.

With `?merge`, `casă` collapses from 11 entries to 4, the first combining DOOM's stress and
inflections, DEXonline's senses and etymology, and Wiktionary's IPA and declension, with
`contributors: ["doom","dexonline","wiktionary","pluralro"]`.

## Pronunciation

`GET /v1/tts/casă` returns audio. `?meta` returns what it is:

```json
{
  "word": "casă",
  "engine": "commons",
  "mime": "application/ogg",
  "bytes": 38135,
  "license": "Public domain",
  "attribution": "Calusarul — via Wikimedia Commons (File:Ro-casă.oga)",
  "sourceUrl": "https://upload.wikimedia.org/wikipedia/commons/9/94/Ro-cas%C4%83.oga",
  "ipa": "/ˈka.sə/",
  "syllabification": "ca-să",
  "stressOrigin": "derived"
}
```

Two tiers:

1. **A human recording** from Wikimedia Commons — `Ro-<word>.oga` plus the Lingua Libre corpus
   (24,088 Romanian files). Free, no API key. Licences differ per file, so licence and attribution
   are read per recording and travel with the audio.
2. **espeak-ng synthesis** (compiled to WebAssembly — no binary to install, no model to download) for
   everything else, so the endpoint always returns audio. It is driven by the IPA below rather than
   by the spelling, so what gets spoken is the verified transcription.

Attribution is also returned in `X-Audio-Engine`, `X-Audio-License`, `X-Audio-Attribution` and
`X-Audio-IPA`. Those are **percent-encoded**, because HTTP headers are ASCII and `/ˈka.sə/` is not;
`?meta` carries the values verbatim.

`?engine=espeak` skips the Commons lookup. Audio is cached on disk under `.cache/tts/`.

**ro.wiktionary is not used for audio.** Of the eight recorded fixture words exactly one carried an
`{{audio}}` template, and it pointed at `Fr-ou.ogg` — the French word.

### IPA and syllabification

Romanian spelling is close to phonemic, so `src/phonetics` derives a transcription for **every**
word, not only the few Wiktionary covers. It is verified against the IPA those fixtures independently
record:

| word | derived | ro.wiktionary |
|---|---|---|
| casă | `/ˈka.sə/` | `/ˈka.sə/` |
| copil | `/koˈpil/` | `/koˈpil/` |
| oaie | `/ˈo̯a.je/` | `/ˈo̯a.je/` |
| merge | `/ˈmer.d͡ʒe/` | `/ˈmer.ʤe/` |

Stress is taken from DOOM's underline markup or DEXonline's accent marker where a dictionary gives
one (`stressOrigin: "attested"`); otherwise the regular pattern is applied and the result is reported
as `"derived"`.

## Conjugation

`GET /v1/conjugate/merge` → `class III`, `inf=merge`, `ind.prez.1sg=merg`, `part.past=mers`,
`imperative.2sg=mergi`.

22 irregular verbs (`fi, avea, vrea, putea, vedea, face, merge, da, sta, lua, bea, ști, veni, spune,
zice, duce, trece, scrie, pune, ține, rămâne, mânca`) come from a table; everything else from a
4-class rule engine. `a fi` and `fi` are equivalent input.

## Accuracy

The API distinguishes what a dictionary said from what it worked out:

- `inflections[].origin` is `attested` or `derived`; `confidence` is `high` or `low`.
- `pronunciations[].stressOrigin` says whether stress came from a dictionary.
- `source.authority` (0–100) says how much weight a contributing dictionary carries.
- On `?merge`, an attested form always beats a rule-derived duplicate, and a known part of speech
  beats `unknown`.

One thing it deliberately does not do: a derived transcription never overwrites an attested one.

DEXonline paradigms are read as a full HTML grid, so both nominal declensions
(casă/casa/case/casele/casei/caselor, tagged with case, number and article) and verb conjugations
(tense, number and person, including the long infinitive and the imperative) are complete and
published as attested inflections.

## Reliability

- Per-provider circuit breaker (5 consecutive failures → open 60 s).
- Per-host token-bucket rate limit (dexonline 2 s per `robots.txt`, DOOM 1.5 s, Wiktionary 250 ms).
- `robots.txt` honoured for every page-scraping provider. `wiktionary` is the one exception
  (`robotsPolicy: 'official-api'`): Wikimedia's `Disallow: /w/` stops search engines indexing dynamic
  wiki pages, while `api.php` is the interface they document for programmatic access and rate-limit
  themselves. The descriptive User-Agent and per-host limit still apply. Wikimedia returns **403**
  without that User-Agent, so it is required rather than merely polite.
- `Promise.allSettled` fan-out: one slow source cannot block the rest. 8 s per provider, 12 s total.
- ETag / Last-Modified replay.
- Output sanitised with `sanitize-html`; input validated with zod (max 64 chars, Romanian letters
  plus `-` and `'`).
- FTS5 queries are quoted, so `AND`, `OR`, `NEAR`, `:` and `^` are searched as text and cannot
  produce a 500.

## Configuration

```
PORT=3000
HOST=0.0.0.0
DB_PATH=./vocabulary.db
USER_AGENT="ro-dexify-api/2.0 (+https://github.com/k6w/ro-dexify-api; non-commercial)"
REQUEST_TIMEOUT_MS=8000
TOTAL_BUDGET_MS=12000
RATE_LIMIT_PER_MIN=60
ENABLE_DLR=false
FORVO_API_KEY=
FORVO_DAILY_QUOTA=500
DEX_DUMP_URL=https://dexonline.ro/static/download/dex-database.sql.gz
REQUIRE_API_KEY=false
```

## Scripts

```
pnpm dev                run with hot reload
pnpm build              compile to dist/ (copies migration SQL)
pnpm start              run the compiled build
pnpm bootstrap [...]    installer + seeder
pnpm seed               re-seed without pnpm install
pnpm fixtures:refresh   re-record test fixtures from the live sources
pnpm test               vitest
pnpm test:ci            vitest + a guard that fails if the suite did not actually run
pnpm check:live         run the parsers against the live sites (upstream drift check)
pnpm typecheck          tsc --noEmit
pnpm lint               biome check
```

## Licensing & attribution

- **DOOM 3** — CC BY-NC-SA 4.0, non-commercial only. Institutul de Lingvistică „Iorgu Iordan –
  Al. Rosetti".
- **DEXonline** — GPL data; the seed dump is downloaded at setup and never committed.
- **Wiktionary RO** — CC BY-SA 4.0.
- **Wikimedia Commons audio** — per file; public domain through CC BY-SA 4.0, returned with each
  response.
- **espeak-ng** — GPL-3.0; the synthesised audio itself is offered as CC0.
- **Forvo** — proprietary, per-clip credit to the speaker.

Per-provider attribution travels in every response in `entry.source.attribution`, and per-recording
attribution in the `/v1/tts` response and headers.

This project is MIT-licensed and non-commercial.
