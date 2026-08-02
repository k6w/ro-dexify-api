# m.dex.ro

The mobile mirror of DEXonline.

- Site: <https://m.dex.ro>
- Licence: GPL-2.0-or-later
- Cache: 7 days · Rate limit: 2000 ms
- Provider id: `mdex`
- **Disabled by default**

## Why it is off

It mirrors the same corpus as [`dexonline`](dexonline.md) in markup that carries
strictly less information — no sense tree, no relations, no paradigm, no
citations. Enabling it by default duplicated every definition and doubled the
request budget for no extra coverage.

## When to use it

As a fallback if DEXonline is unreachable, or to compare renderings:

```bash
curl -s 'localhost:3000/v1/word/casă?sources=mdex' | jq '.entries[0]'
```

Naming it in `?sources=` enables it for that request.

## What it gives

Definitions with the contributing dictionary in `source.workTitle`, and numbered
senses where the text is numbered. No relations, no paradigm, no citations.

## How it is read

Each definition is a `.mydef` block:

```html
<strong>CÁSĂ1,</strong> s. f. 1. Clădire… (<span>Sursa: DEX '98</span>)
<button data-clipboard-text="…">Copy to clipboard</button>
```

Three things need care:

- the headword has the tonic accent, homonym index and a comma fused on —
  `CÁSĂ1,` becomes lemma `CÁSĂ` with `homonymIndex: 1`
- the "Copy to clipboard" button repeats the whole definition and must be
  removed before reading the text
- the `(Sursa: X)` note names the dictionary and must not leak into the
  definition
