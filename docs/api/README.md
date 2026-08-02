# API overview

Every endpoint is a `GET`. Nothing here writes anything, so nothing you send can
break state. Responses are JSON except pronunciation audio.

## Endpoints

| Endpoint | Purpose | Docs |
|---|---|---|
| `/v1/word/:word` | Look a word up | [Word lookup](word-lookup.md) |
| `/v1/word/:word/:source` | Look it up in one provider | [Word lookup](word-lookup.md#single-provider) |
| `/v2/word/:word` | Same, richer shape | [Versions](versions.md) |
| `/v2/word/:word/:source` | Same, one provider | [Versions](versions.md) |
| `/v1/tts/:word` | Pronunciation audio | [Pronunciation](pronunciation.md) |
| `/v1/search` | Full-text search over cached entries | [Search](search.md) |
| `/v1/conjugate/:verb` | Conjugate a verb | [Conjugation](conjugation.md) |
| `/v1/pluralize/:noun` | Pluralise a noun | [Pluralization](pluralization.md) |
| `/v1/audio/:word` | Forvo audio (needs a key) | [Pronunciation](pronunciation.md#forvo) |
| `/v1/sources` | Which providers exist and their health | [Sources endpoint](sources.md) |
| `/v1/healthz` | Liveness | [Health](health.md) |
| `/openapi.json` | Machine-readable API description | below |
| `/docs` | Interactive reference | below |

## `/docs` and `/openapi.json`

`/openapi.json` is an [OpenAPI](https://www.openapis.org/) document: a standard
JSON description of every endpoint, parameter and response. Tools read it to
generate client libraries, populate Postman, or drive tests.

`/docs` renders that document as a browsable page. Expand an endpoint, fill in a
parameter, press the button, see the real response.

You do not need either to use this API, curl works fine, but `/docs` is the
fastest way to see what a parameter is called.

Both are generated from the code, so they cannot drift out of date. A test
asserts every mounted route appears in the document.

## Response shape

Word lookups always return this envelope:

```json
{
  "headword": "casă",
  "entries": [ … ],
  "cache":  { "hits": 8, "misses": 0 },
  "errors": [ … ]
}
```

- **`entries`**: the results. Possibly empty.
- **`cache`**: how many entries came from cache vs a fresh fetch. Useful for
  understanding latency; ignorable otherwise.
- **`errors`**: providers that failed. **This is normally empty.** A non-empty
  `errors` with a non-empty `entries` means some sources worked and some did
  not: the response is still usable. See [Errors](errors.md).

One slow or broken dictionary never fails the whole request.

## Input rules

Words are validated before anything else happens. A word must be:

- 1–64 characters
- letters, combining marks, spaces, `-` and `'` only

Anything else gets `400 INVALID_INPUT`. This is why `/v1/word/<script>` is
rejected rather than processed.

Percent-encode diacritics if your tooling needs it: `cas%C4%83` is `casă`.

## Rate limiting

The API rate-limits *itself* against upstream dictionaries so it stays a polite
client, see [Rate limits & robots](../operations/rate-limits-robots.md). There
is also an inbound limit (`RATE_LIMIT_PER_MIN`, default 60/min per client).
