# Getting started

Goal: a running server and a real response. About five minutes.

## 1. Requirements

- **Node 20 or newer.** Check with `node --version`.
- **pnpm.** If you do not have it: `npm install -g pnpm`.

Nothing else. No database server, no Docker, no admin rights. The API stores
everything in a single SQLite file.

## 2. Install

```bash
pnpm install
```

## 3. Create the database

```bash
pnpm bootstrap --lite
```

This creates the tables and loads a small starter set of words (~3 MB) from
DEXonline's freely licensed database dump.

Three ways to run it, pick one:

| Command | What it does | When |
|---|---|---|
| `pnpm bootstrap --no-seed` | Tables only, no words | Fastest. Words are fetched live on first request. |
| `pnpm bootstrap --lite` | Tables + ~8,000 senses | **Recommended.** Good balance. |
| `pnpm bootstrap --full` | Tables + the whole dictionary | Several hundred MB. Offline use. |

You can change your mind later; re-run with a different flag.

## 4. Start it

```bash
pnpm dev
```

You should see it listening on port 3000. Leave this terminal running.

## 5. Your first request

Open a **second** terminal:

```bash
curl 'localhost:3000/v1/healthz'
```

Expected:

```json
{ "status": "ok", "uptime": 0.12, "db": "ok", "breakers": {} }
```

If you see that, everything works. Now look up a word:

```bash
curl 'localhost:3000/v1/word/casă'
```

That is a lot of JSON. Install [`jq`](https://jqlang.github.io/jq/) to read it
comfortably (`brew install jq`), then:

```bash
curl -s 'localhost:3000/v1/word/casă' | jq '.entries[0].senses[0].text'
```

```
"Clădire care servește drept locuință."
```

## 6. Hear it

```bash
curl -s 'localhost:3000/v1/tts/casă' -o casa.oga
```

Play `casa.oga` with anything (`afplay casa.oga` on macOS). That is a real human
recording from Wikimedia Commons. See [Pronunciation](api/pronunciation.md) for
how the voice is chosen and how to change it.

## 7. Browse everything

Open <http://localhost:3000/docs> in a browser for the interactive reference.

## Diacritics in URLs

`casă` contains `ă`, which is not an ASCII character. `curl` handles it, but if
a tool complains, percent-encode it: `cas%C4%83`.

You can also just type it without diacritics — `casa` finds `casă` — see
[Search](api/search.md).

## What next

- [Concepts](concepts.md) — the vocabulary used everywhere else
- [Word lookup](api/word-lookup.md) — the main endpoint, in full
- [Troubleshooting](operations/troubleshooting.md) — if something above failed
