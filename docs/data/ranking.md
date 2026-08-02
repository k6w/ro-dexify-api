# Ranking, deduplication and merging

A lookup for `casă` reaches 32 dictionaries and 120 DEXonline definitions. Left
raw, current definitions sit beside century-old ones with no ordering. Three
mechanisms shape that into a usable response.

All three run **after the cache**, so they never affect what is fetched or
stored, and filtering costs nothing.

## 1. Authority

Each contributing dictionary has a 0–100 score.

| Score | Tier | Examples |
|---|---|---|
| 90–98 | Current, normative | DOOM 3 (98), DEX '09 (95), DEXI (92), MDA2 (90) |
| 66–80 | Recent standard | DEX '98, DEX '96, MDN, NODEX, DN |
| 50–60 | Mid-century academic | DLRLC (1957), DLRM (1958), DER (1966) |
| 20–45 | Specialist, thematic | DCR2, DRAM, DGS, Argou, Sinonime |
| 12–18 | Historical | CADE (1926), Scriban (1939), Șăineanu (1929) |

Unlisted dictionaries default to 25.

Results are ordered by authority descending; ties break toward the entry with
more senses. `source.authority` is on every entry, so you can re-rank.

## 2. Deduplication

Dictionaries copy each other. An entry whose senses are all already covered by a
higher-authority entry is dropped.

Comparison is diacritic- and punctuation-insensitive and deliberately
conservative, only near-identical text collapses. Different wordings of the
same idea both survive.

Entries with only very short senses are always kept, since a short string is too
weak a key to drop anything on.

`?all` skips this.

## 3. The cap

Default 8 entries **per provider**; `?limit=N` changes it, `?all` removes it.

## Orthographic sources

DOOM, DOOM 2, Ortografic and MDO publish spelling and inflection but no
definitions. They have the highest authority, so included by default they would
fill the response with entries carrying no meanings.

They are excluded unless you pass `?orthographic`. A provider is never filtered
to nothing by this rule, the `doom` provider's own entries are orthographic by
nature and always come through.

## Merging

`?merge` combines entries describing the same word.

**Grouping** is by lemma + part of speech + homonym index. Genuine homonyms stay
apart. Only DEXonline publishes a homonym index, so an entry without one joins
the lowest-numbered homonym for its lemma, otherwise DOOM's stress would never
reach the senses it belongs to.

**Combining:**

| Field | Rule |
|---|---|
| `partOfSpeech` | First non-`unknown` |
| `gender`, `etymology`, `paradigm` | From the highest-authority entry that has one |
| `inflections` | Union; attested beats a derived duplicate |
| `pronunciations` | Union, deduplicated by transcription |
| `senses` | Union, near-duplicates dropped, renumbered |
| `derived`, `compounds` | Union |
| `contributors` | Every provider that fed in |
| `source` | The highest-authority contributor |

Merging is off by default: the unmerged view is what tells you which source said
what, and that matters for attribution.

## Worked example

```bash
curl -s 'localhost:3000/v2/word/casă?sources=dexonline'      | jq '.entries|length'  # 8
curl -s 'localhost:3000/v2/word/casă?sources=dexonline&all'  | jq '.entries|length'  # 28
curl -s 'localhost:3000/v2/word/casă?merge'                  | jq '.entries|length'  # 4
```

120 definitions → 28 after lemma matching and the orthographic exclusion → 8
after ranking and deduplication. Across all providers, `?merge` gives 4, one
per distinct word.
