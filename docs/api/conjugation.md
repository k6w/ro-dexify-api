# Conjugation

```
GET /v1/conjugate/:verb
```

```bash
curl -s 'localhost:3000/v1/conjugate/merge' | jq
```

```json
{
  "verb": "merge",
  "classRoman": "III",
  "forms": {
    "inf": "merge",
    "part.past": "mers",
    "gerund": "mergând",
    "imperative.2sg": "mergi",
    "ind.prez.1sg": "merg",
    "ind.prez.3sg": "merge"
  },
  "source": "rules"
}
```

## Input

Both citation forms work — `a fi` and `fi` give identical results. The `a`
particle is stripped.

```bash
curl -s 'localhost:3000/v1/conjugate/a%20fi' | jq '.forms["ind.prez.1sg"]'   # "sunt"
```

## Form keys

| Key | Meaning |
|---|---|
| `inf` | infinitive |
| `inf.long` | long infinitive (`mergere`) |
| `part.past` | past participle |
| `gerund` | gerund |
| `imperative.2sg` / `.2pl` | imperative |
| `ind.prez.<1\|2\|3><sg\|pl>` | present indicative |
| `ind.imperf.…` | imperfect |
| `ind.perfsimp.…` | simple perfect |
| `conj.prez.3sg` / `.3pl` | present subjunctive |

## `source`

- `seeded` — from the DEXonline database dump. Real data.
- `rules` — computed here.

## How forms are produced

Two mechanisms:

**An irregular table**, for verbs no rule derives, covering:

```
fi, avea, vrea, putea, vedea, face, merge, da, sta, lua, bea, ști,
veni, spune, zice, duce, trece, scrie, pune, ține, rămâne, mânca
```

These are the ones where the stem itself changes (`face` → `făcut`,
`vedea` → `văzut`) or the paradigm is suppletive (`fi` → `sunt`, `fost`). The
table lists only the cells that differ; the rest come from the rules.

**A four-class rule engine** for everything else, keyed on the infinitive
ending: `-a` (I), `-ea` (II), `-e` (III), `-i`/`-î` (IV).

## Accuracy

A regular verb is reliable. An irregular verb *not* in the table above will be
conjugated by rule and may be wrong — Romanian has stem alternations
(`a↔ă`, `e↔ea`, `d↔z`) that the rules do not fully model.

If a word matters, cross-check against `/v2/word/<verb>`, where DOOM and
DEXonline publish attested forms:

```bash
curl -s 'localhost:3000/v2/word/merge?sources=doom' \
  | jq '.entries[].inflections[] | { form, tags }'
```

Those carry `origin: "attested"`. See [Accuracy](../data/accuracy.md).
