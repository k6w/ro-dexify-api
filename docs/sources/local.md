# Local providers

Two providers do no networking. They compute answers from rules, so they are
instant, always available, and cached for a year.

## `conjugare` — verb conjugation

Provides `conjugation`. Backs [`/v1/conjugate`](../api/conjugation.md).

Two mechanisms:

1. **An irregular table** for the closed class of verbs no rule derives —
   `fi, avea, vrea, putea, vedea, face, merge, da, sta, lua, bea, ști, veni,
   spune, zice, duce, trece, scrie, pune, ține, rămâne, mânca`. Only the cells
   that differ are listed; the rest come from the rules.
2. **A four-class rule engine** for everything else, keyed on the infinitive
   ending: `-a` (I), `-ea` (II), `-e` (III), `-i`/`-î` (IV).

Where the DEX dump has been seeded, attested forms are used instead and
`/v1/conjugate` reports `source: "seeded"`.

Output is marked `origin: "derived"` in `/v2`, so it never displaces an attested
form under [`?merge`](../api/word-lookup.md#merge).

**Caveat:** an irregular verb outside the table is conjugated by rule and may be
wrong. Romanian stem alternations (`a↔ă`, `e↔ea`, `d↔z`) are not fully modelled.

## `pluralro` — pluralisation

Provides `pluralization`. Backs [`/v1/pluralize`](../api/pluralization.md).

Rule-based, so irregulars are exactly where it fails: `ou` → `ouă`,
`oaie` → `oi`, `om` → `oameni`. Output carries
`confidence: "high"` or `"low"` depending on how well the rule matched, and is
always `origin: "derived"`.

Prefer an attested plural from `/v2/word` when one exists.

## Why they are providers at all

They go through the same interface as network sources, so they appear in
`/v1/sources`, respond to `?sources=` and `?include=`, and merge into the same
entries. That is what lets `?merge` prefer DOOM's attested plural over
`pluralro`'s computed one automatically.
