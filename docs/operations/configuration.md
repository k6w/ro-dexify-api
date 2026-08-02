# Configuration

Everything is environment variables. Copy `.env.example` and edit, or export
them directly.

## Server

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `3000` | |
| `HOST` | `0.0.0.0` | |
| `NODE_ENV` | `development` | `development`, `production`, `test` |
| `LOG_LEVEL` | `info` | `fatal`…`trace`, or `silent` |

## Storage

| Variable | Default | Notes |
|---|---|---|
| `DB_PATH` | `./vocabulary.db` | SQLite file. Parent directory is created. |

Everything lives here: cache, seeded words, search index, Forvo quota. Delete it
to start clean; `pnpm bootstrap` recreates it.

## Networking

| Variable | Default | Notes |
|---|---|---|
| `USER_AGENT` | `ro-dexify-api/2.0 (+…)` | **Set this.** Wikimedia returns 403 without a descriptive one. |
| `REQUEST_TIMEOUT_MS` | `8000` | Per provider |
| `TOTAL_BUDGET_MS` | `12000` | Whole lookup |
| `RATE_LIMIT_PER_MIN` | `60` | Inbound, per client |

`USER_AGENT` should identify your deployment and give a contact. It is how the
sites tell you apart from a scraper.

## Pronunciation

| Variable | Default | Notes |
|---|---|---|
| `TTS_VOICE` | — | espeak variant override, e.g. `ro+f5` |
| `PIPER_BIN` | — | Path to the Piper binary |
| `PIPER_MODEL` | — | Path to `ro_RO-mihai-medium.onnx` |

Synthesis is female (`ro+f3`) unless overridden. Piper is used only for
`?voice=male` and only when both paths exist. See
[Pronunciation](../api/pronunciation.md).

## Optional providers

| Variable | Default | Notes |
|---|---|---|
| `FORVO_API_KEY` | — | Enables the `forvo` provider |
| `FORVO_DAILY_QUOTA` | `500` | Requests per day |
| `ENABLE_DLR` | `false` | **Has no effect** — DLR's endpoint no longer exists |

## Seeding

| Variable | Default | Notes |
|---|---|---|
| `DEX_DUMP_URL` | DEXonline's dump URL | Used by `pnpm bootstrap` |

## Access control

| Variable | Default | Notes |
|---|---|---|
| `REQUIRE_API_KEY` | `false` | |

## Example

```bash
PORT=8080
DB_PATH=/var/lib/ro-dexify/vocabulary.db
USER_AGENT="my-app/1.0 (+https://example.com/contact; non-commercial)"
LOG_LEVEL=info
TTS_VOICE=ro+f3
```

Invalid configuration fails at startup with a message naming the variable —
it is validated, not silently defaulted.
