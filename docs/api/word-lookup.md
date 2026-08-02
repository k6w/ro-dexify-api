# Word lookup

The main endpoint.

```
GET /v1/word/:word
GET /v2/word/:word
```

`/v1` and `/v2` take identical parameters and differ only in the shape of each
entry — see [Versions](versions.md). Examples here use `/v1`.

## Simplest case

```bash
curl -s 'localhost:3000/v1/word/casă' | jq '.entries | length'
```

```
11
```

Eleven entries, because several dictionaries describe `casă`. To see who said
what:

```bash
curl -s 'localhost:3000/v1/word/casă' \
  | jq '.entries[] | { source: .source.workTitle, senses: (.senses | length) }'
```

## Parameters

| Parameter | Type | Default | Effect |
|---|---|---|---|
| `sources` | list | all enabled | Only these providers |
| `dict` | list | all | Only these contributing dictionaries |
| `all` | flag | off | No ranking, deduplication or cap |
| `limit` | 1–200 | 8 | Max entries per provider |
| `orthographic` | flag | off | Include entries with grammar but no definitions |
| `merge` | flag | off | Combine providers into one entry per word |
| `refresh` | flag | off | Ignore the cache, refetch |
| `include` | list | all | Only providers with these capabilities |

Flags accept the bare form (`?all`), `?all=true` or `?all=1`.

### `sources`

Providers, comma-separated:

```bash
curl -s 'localhost:3000/v1/word/casă?sources=doom,wiktionary'
```

Valid ids: `doom`, `dexonline`, `wiktionary`, `mdex`, `forvo`, `dlr`,
`conjugare`, `pluralro`. `/v1/sources` lists which are enabled.

Some are off by default — `mdex` duplicates DEXonline, `forvo` needs a key,
`dlr` is unavailable. Naming one in `?sources=` enables it for that request
(except `dlr`, which cannot work — see [DLR](../sources/dlr.md)).

### `dict`

Contributing dictionaries, comma-separated. Different from `sources`: see
[Concepts](../concepts.md#provider-vs-source).

```bash
curl -s "localhost:3000/v1/word/casă?dict=DEX '09,MDA2"
```

Names must match exactly, including the apostrophe in `DEX '09`. To see what is
available for a word:

```bash
curl -s 'localhost:3000/v1/word/casă?all' | jq -r '.entries[].source.workTitle' | sort -u
```

### `all`

By default a lookup for `casă` is trimmed from 120 DEXonline definitions to 8
ranked, deduplicated entries. `?all` turns that off.

```bash
curl -s 'localhost:3000/v1/word/casă?sources=dexonline'      | jq '.entries|length'   # 8
curl -s 'localhost:3000/v1/word/casă?sources=dexonline&all'  | jq '.entries|length'   # 28
```

Use it when you want everything a source has; the default when you want the good
parts. See [Ranking](../data/ranking.md).

### `limit`

Caps entries **per provider**, not per response. `?limit=2` with three providers
can return six entries.

### `orthographic`

Some entries carry inflections but no definitions — DOOM's copy inside
DEXonline, for instance. They rank highest by authority, so if included by
default they would push every actual definition off the front. They are excluded
unless you ask.

```bash
curl -s 'localhost:3000/v1/word/casă?sources=dexonline&all&orthographic' | jq '.entries|length'
```

### `merge`

Combines every provider's account of the same word into one entry.

```bash
curl -s 'localhost:3000/v2/word/casă?merge' | jq '.entries[0] | {
  displayHeadword, partOfSpeech, gender, contributors,
  senses: (.senses|length), inflections: (.inflections|length)
}'
```

```json
{
  "displayHeadword": "casă",
  "partOfSpeech": "substantiv",
  "gender": "feminin",
  "contributors": ["doom", "dexonline", "wiktionary", "pluralro"],
  "senses": 15,
  "inflections": 11
}
```

Eleven entries become four — one per distinct word. DOOM's stress, DEXonline's
senses and Wiktionary's IPA end up on one object, with `contributors` recording
who supplied what.

Genuine homonyms stay apart: `casă¹` (building) and `casă²` (cash desk) remain
separate entries. Attested values beat derived ones. See
[Ranking](../data/ranking.md#merging).

Off by default because the unmerged view is what tells you which source said
what.

### `refresh`

Skips the cache and refetches from upstream. Slow (a DEXonline miss is ~2.5 s)
and rate-limited. For debugging, not normal traffic.

### `include`

Filter providers by capability rather than by name:

```bash
curl -s 'localhost:3000/v1/word/casă?include=definitions'
```

Capabilities: `definitions`, `etymology`, `examples`, `inflections`,
`conjugation`, `pluralization`, `pronunciation_text`, `pronunciation_audio`,
`register_notes`.

## Single provider

```
GET /v1/word/:word/:source
```

```bash
curl -s 'localhost:3000/v1/word/casă/doom' | jq
```

Equivalent to `?sources=` with one name, but returns `400` for an unknown
provider id rather than silently returning nothing. Takes the same parameters.

## Filtering happens after the cache

Every filter above is applied to the response, not to what gets fetched or
stored. One upstream fetch serves every view, and a narrow request cannot
poison a later broad one:

```
?dict=DEX '09  →  2 entries   (2 fetches)
unfiltered     →  8 entries   (0 fetches, all cached)
?all           → 28 entries   (0 fetches, all cached)
```

Practical consequence: filtering costs nothing. Ask for exactly what you need.

## Empty results

An unknown word returns `200` with an empty or near-empty `entries`, and often a
`PROVIDER_UPSTREAM_ERROR` in `errors` from a source that answered 404. That is
not a failure of the API — see [Errors](errors.md).

```bash
curl -s 'localhost:3000/v1/word/zzzqqq' | jq '{ entries: (.entries|length), errors }'
```
