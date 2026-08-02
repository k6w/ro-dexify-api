# ro-dexify-api documentation

A Romanian dictionary API. You give it a word; it gives you definitions,
grammar, pronunciation and audio, drawn from several dictionaries and normalised
into one shape.

**New here? Read [Getting started](getting-started.md) first** — it gets you a
running server and a first response in about five minutes.

## Start here

| If you want to… | Read |
|---|---|
| Install it and make one request | [Getting started](getting-started.md) |
| Understand the words used everywhere (entry, sense, lemma…) | [Concepts](concepts.md) |
| Look a word up | [Word lookup](api/word-lookup.md) |
| Get pronunciation audio | [Pronunciation & TTS](api/pronunciation.md) |
| Know which endpoint exists | [API overview](api/README.md) |
| Know what every field in a response means | [Entry schema](data/entry-schema.md) |
| Know how much to trust a value | [Accuracy](data/accuracy.md) |
| Know where the data comes from | [Sources](sources/README.md) |
| Run it in production | [Operations](operations/configuration.md) |
| Change the code | [Architecture](contributing/architecture.md) |

## About the interactive docs

The server also serves an interactive API reference at `/docs` and a machine
readable description at `/openapi.json`.

That page is generated from the code, so it is always in sync — but it is a
*reference*, not an explanation. It tells you that `/v1/word/{word}` takes a
`dict` parameter; it does not tell you why you would want one. **These pages are
the explanation.** Use both: read here to understand, use `/docs` to look up a
parameter name quickly.

If you have never used a page like `/docs` before: it lists every URL the API
answers, what you can send it, and what comes back. You can expand any entry and
press a button to send a real request from your browser. Nothing there can break
anything — every endpoint in this API is read-only.

## The short version

```bash
pnpm install
pnpm bootstrap --lite
pnpm dev
```

```bash
curl 'localhost:3000/v1/word/casă' | jq
curl 'localhost:3000/v1/tts/casă' -o casa.oga
```

## A note on honesty

This API separates what a dictionary actually said from what the software worked
out. Fields carry `origin: "attested"` or `"derived"`, and `confidence`. When
you see a derived value, a rule produced it and it may be wrong.
[Accuracy](data/accuracy.md) explains exactly where the line is.
