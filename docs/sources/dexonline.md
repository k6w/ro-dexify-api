# DEXonline

The largest free Romanian dictionary aggregator — 32 dictionaries in one place,
from the current DEX '09 to Scriban (1939).

- Site: <https://dexonline.ro>
- Licence: GPL-2.0-or-later (the data)
- Cache: 7 days · Rate limit: 2000 ms (its `robots.txt` `Crawl-delay`)
- Provider id: `dexonline`

## What it gives

The richest source here:

- definitions, as a numbered sense tree
- etymology
- typed relations: synonyms, antonyms, diminutives, augmentatives
- examples **with bibliographic citations**
- full declension and conjugation tables
- stress (as a tonic accent marker)
- per-sense attribution to the contributing dictionary

## It makes two requests

A cache miss fetches **two** documents, 2 seconds apart:

1. **`/definitie/<word>/json`** — the structured API. Definitions, sense
   numbering, grammatical labels, stress.
2. **`/definitie/<word>`** — the rendered page. Relations, cited examples and
   the declension table, which the JSON does not carry.

Cold lookups therefore take ~2.5 s. Both land in one cache entry, so cache hits
cost nothing extra. If the second request fails, the JSON result is still
returned.

## Contributing dictionaries

`source.sourceName` names the dictionary a definition came from, and `?dict=`
filters on it:

```bash
curl -s "localhost:3000/v1/word/casă?sources=dexonline&dict=DEX '09"
```

Because 120 definitions for one word is unusable raw, results are ranked by
authority, deduplicated and capped — see [Ranking](../data/ranking.md).

## DOOM inside DEXonline

DEXonline also carries DOOM. Those entries have the highest authority but **no
definitions**, so they are excluded by default (`?orthographic` includes them).
The dedicated [`doom`](doom.md) provider covers the same data better, with the
stress and syllabification this copy lacks.

## How it is read

The JSON carries DEXonline's own markup in `internalRep`:

```
@C'ASĂ^1,@ $case,$ #s. f.# @1.@ Clădire care servește drept locuință.
* #Loc. adj.# $De casă$ = făcut în casă^1. ** (#Reg.#) Cameră, odaie.
@2.@ Încăpere specială… - #Lat.# @casa.@
```

| Token | Meaning |
|---|---|
| `@…@` | bold — headword, and sense numbers `@1.@` |
| `$…$` | italic — inflections, expressions |
| `#…#` | abbreviation — `#s. f.#`, `#Reg.#` |
| `'` | **tonic accent**, before the stressed vowel |
| `^n` | homonym index |
| `*` / `**` | locution (◊) / sub-sense (♦) |

The rendered page supplies the meaning tree (`ul.meaningTree`) and the paradigm
tables, which are read as a proper HTML grid with `rowspan`/`colspan` — a verb
table is several stacked blocks, each with its own header row.

## Caveats

- Slowest provider on a cache miss.
- Historical dictionaries contradict current ones. Trust `authority`.
- A search for `casă` also matches `casă-muzeu` and `gândac-de-casă`; other
  lemmas are dropped unless you ask for them.
