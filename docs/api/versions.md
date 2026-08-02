# `/v1` vs `/v2`

Same lookup, same parameters, different entry shape.

**Use `/v2` for new code.** `/v1` exists so existing clients keep working and
its shape is frozen.

## The difference

`/v1` senses are a flat list. `/v2` senses are a tree.

Dictionaries do not write flat senses. DEXonline hangs locutions (◊) and
sub-senses (♦) under a numbered sense; Wiktionary hangs examples under one.
Flattening loses which is which. `/v2` keeps it; `/v1` is produced from `/v2` by
a flattening adapter.

### Same sense, both shapes

`/v1`:

```json
{
  "number": 1,
  "text": "Clădire care servește drept locuință.",
  "register": [],
  "examples": [
    { "text": "Casa e așezată în dreptul ariei.", "citation": "STANCU, D. 19." },
    { "text": "Loc. adj. De casă = făcut în casă." }
  ],
  "synonyms": ["cameră", "odaie"],
  "antonyms": []
}
```

`/v2`:

```json
{
  "number": 1,
  "text": "Clădire care servește drept locuință.",
  "type": "meaning",
  "register": [],
  "sources": ["DEX '09", "DLRLC"],
  "relations": {
    "synonyms": ["cameră", "odaie"],
    "antonyms": [],
    "diminutives": ["căscioară", "căsuță"],
    "augmentatives": ["căsoaie"],
    "hypernyms": []
  },
  "children": [
    { "type": "example",  "text": "Casa e așezată în dreptul ariei.", "citation": "STANCU, D. 19." },
    { "type": "locution", "text": "Loc. adj. De casă = făcut în casă." },
    { "type": "sub-meaning", "text": "(Reg.) Cameră, odaie." }
  ]
}
```

`/v1` folded the example and the locution into one `examples` list, promoted the
sub-meaning to a top-level sense, and dropped the diminutives entirely, there
is nowhere in the v1 shape to put them.

## What only `/v2` has

| Field | Meaning |
|---|---|
| `senses[].type` | `meaning`, `sub-meaning`, `example`, `expression`, `locution`, `etymology` |
| `senses[].children` | Nested senses |
| `senses[].sources` | Which dictionaries attest this sense |
| `senses[].relations` | Typed: synonyms, antonyms, diminutives, augmentatives, hypernyms |
| `homonymIndex` | `casă¹` vs `casă²` |
| `paradigm` | The full declension/conjugation table |
| `inflections[].origin` / `.confidence` | Attested vs derived |
| `derived`, `compounds` | Related words that are *not* senses |
| `source.authority` | 0–100 weight |
| `source.sourceName` | Contributing dictionary |

## Flattening rules

If you need to reproduce `/v1` from `/v2`:

- `meaning` and `sub-meaning` nodes become senses, renumbered depth-first
- `example`, `expression` and `locution` children collapse into the parent's
  `examples`
- `relations.synonyms` / `.antonyms` become the sense's `synonyms` / `antonyms`
- everything else is dropped

## What is versioned

Only `/word`. `search`, `tts`, `conjugate`, `pluralize`, `sources` and `healthz`
are shared and live under `/v1`.
