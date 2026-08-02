# Sources

Where the data comes from. One page per provider.

| Provider | Provides | Default | Page |
|---|---|---|---|
| `doom` | Orthography, stress, syllabification, inflections | on | [DOOM 3](doom.md) |
| `dexonline` | Definitions, senses, etymology, relations, declension | on | [DEXonline](dexonline.md) |
| `wiktionary` | Definitions, etymology, IPA, declension | on | [Wiktionary](wiktionary.md) |
| `conjugare` | Verb conjugation | on (local) | [Local providers](local.md) |
| `pluralro` | Pluralisation | on (local) | [Local providers](local.md) |
| `mdex` | Definitions (DEXonline mirror) | off | [m.dex.ro](mdex.md) |
| `forvo` | Human audio | off (needs key) | [Forvo](forvo.md) |
| `dlr` | Academic definitions | **unavailable** | [DLR](dlr.md) |

Pronunciation audio comes from Wikimedia Commons, which is not a provider in
this sense — see [Pronunciation](../api/pronunciation.md).

## How a provider works

Every network provider follows the same path:

1. **Memory cache** — 5 minutes.
2. **SQLite cache** — per-provider TTL (below). Still fresh? Return it.
3. **robots.txt** — checked and cached 24 h.
4. **Rate limit** — per host, so parallel lookups queue rather than flood.
5. **Circuit breaker** — 5 consecutive failures opens it for 60 s.
6. **Fetch**, with `ETag`/`If-Modified-Since` when a previous copy exists.
7. **Parse** into the entry shape.
8. **Store** and return.

A failure at any step yields a provider error inside a `200` response — never a
failed request. See [Errors](../api/errors.md).

## Cache lifetimes

| Provider | TTL | Why |
|---|---|---|
| `doom` | 30 days | Normative, changes with editions |
| `dexonline` | 7 days | Actively edited |
| `mdex` | 7 days | Mirrors DEXonline |
| `wiktionary` | 3 days | Anyone can edit it |
| `forvo` | 90 days | Recordings do not change |
| `dlr` | 60 days | Academic, static |
| `conjugare` | 365 days | Computed locally |
| `pluralro` | 365 days | Computed locally |

`?refresh` bypasses the cache for one request.

## Rate limits

| Provider | Min interval | Concurrency |
|---|---|---|
| `dexonline` | 2000 ms | 1 |
| `mdex` | 2000 ms | 1 |
| `doom` | 1500 ms | 1 |
| `dlr` | 3000 ms | 1 |
| `wiktionary` | 250 ms | 4 |
| `forvo` | 200 ms | 2 |
| `conjugare`, `pluralro` | 0 | unlimited (local) |

DEXonline's 2 s is its `robots.txt` `Crawl-delay`. See
[Rate limits & robots](../operations/rate-limits-robots.md).

## Licensing

Each source has its own terms, carried on every entry in `source.license` and
`source.attribution`. **If you republish, honour them.** DOOM 3 is
non-commercial only.
