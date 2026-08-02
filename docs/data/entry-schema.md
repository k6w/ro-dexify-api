# Entry schema

Every field of a `/v2` entry. `/v1` is a flattened subset — see
[Versions](../api/versions.md).

## Top level

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable for the same source + word |
| `headword` | string | Lowercased, normalised. The key. |
| `displayHeadword` | string | As the source wrote it (`CASĂ`, `casă`) |
| `homonymIndex` | number? | `casă¹` vs `casă²`, when a source distinguishes them |
| `partOfSpeech` | enum | See below |
| `gender` | enum? | `masculin`, `feminin`, `neutru`, `comun` |
| `inflections` | array | Word forms |
| `paradigm` | object? | The full form table |
| `pronunciations` | array | IPA, stress, syllables, audio |
| `senses` | array | Meanings, as a tree |
| `etymology` | object? | `{ text, languages }` |
| `derived` | string[] | Derived words. **Not senses.** |
| `compounds` | string[] | Compounds. **Not senses.** |
| `source` | object | Provenance |

`partOfSpeech`: `substantiv`, `adjectiv`, `verb`, `adverb`, `pronume`,
`numeral`, `prepoziție`, `conjuncție`, `interjecție`, `articol`, `locuțiune`,
`expresie`, `unknown`.

`unknown` means no source stated it — not that the word has no part of speech.

## `senses[]` — a tree

| Field | Type | Notes |
|---|---|---|
| `number` | number? | As the dictionary numbered it |
| `text` | string | The definition |
| `type` | enum | `meaning`, `sub-meaning`, `example`, `expression`, `locution`, `etymology` |
| `register` | string[] | `regional`, `învechit`, `figurat`, `popular`… |
| `domain` | string? | Subject field |
| `citation` | string? | For examples: `"STANCU, D. 19."` |
| `sources` | string[] | Dictionaries attesting this sense |
| `relations` | object | See below |
| `children` | sense[] | Nested senses, same shape |

`relations`: `synonyms`, `antonyms`, `diminutives`, `augmentatives`,
`hypernyms` — all string arrays, all present, possibly empty.

Only `meaning` and `sub-meaning` are meanings. An `example` child is a quotation
of the parent; a `locution` or `expression` is a fixed phrase. Filter on `type`
if you only want definitions.

## `inflections[]`

| Field | Type | Notes |
|---|---|---|
| `form` | string | The word form |
| `tags` | string[] | What it is |
| `origin` | enum | `attested` or `derived` |
| `confidence` | enum | `high` or `low` |

Common tags: `nominative`, `accusative`, `genitive`, `dative`, `vocative`,
`singular`, `plural`, `articulated`, `unarticulated`, `infinitive`, `long`,
`participle`, `gerund`, `imperative`, `indicative`, `subjunctive`, `present`,
`imperfect`, `simple-perfect`, `pluperfect`, `person:1|2|3`.

Tags are a set, not a path: `["genitive","dative","plural","articulated"]`
describes `caselor` completely. Romanian merges genitive and dative, hence both.

Always check `origin` before trusting a form — see [Accuracy](accuracy.md).

## `paradigm`

| Field | Type | Notes |
|---|---|---|
| `modelCode` | string? | DEXonline inflection model, e.g. `F1`, `VT201` |
| `classRoman` | string? | Conjugation class `I`–`IV` |
| `cells` | array | `{ tags: string[], forms: string[] }` |

`inflections` is the flat list; `paradigm.cells` is the same data as a table.
Use `cells` to render a declension grid.

## `pronunciations[]`

| Field | Type | Notes |
|---|---|---|
| `ipa` | string? | `/ˈka.sə/` |
| `stressMark` | string? | Lemma with an acute on the stressed vowel: `cásă` |
| `stressIndex` | number? | Index of the stressed vowel |
| `syllabification` | string? | `ca-să` |
| `audioUrl` | string? | Forvo only; `/v1/tts` is the general route |
| `audioMime`, `audioAttribution` | string? | With `audioUrl` |

## `source`

| Field | Type | Notes |
|---|---|---|
| `providerId` | string | `doom`, `dexonline`… |
| `providerName` | string | Human name |
| `sourceName` | string? | Contributing dictionary: `DEX '09` |
| `workTitle` | string? | Full title |
| `authority` | number | 0–100, see [Ranking](ranking.md) |
| `year` | number? | Edition year, where known |
| `url` | string | The page this came from |
| `license` | string | **Honour this if you republish** |
| `attribution` | string | **Credit line** |
| `fetchedAt` | ISO date | When it was fetched |
| `cacheHit` | boolean | Served from cache |

## Merged entries

With [`?merge`](../api/word-lookup.md#merge) each entry gains:

| Field | Type | Notes |
|---|---|---|
| `contributors` | string[] | Provider ids that fed into it |

`source` then describes the highest-authority contributor, not all of them.
