# Pluralization

```
GET /v1/pluralize/:noun
```

```bash
curl -s 'localhost:3000/v1/pluralize/casă' | jq
```

```json
{ "singular": "casă", "plural": "case", "gender": "feminin" }
```

## This is rule-based

The plural is **computed**, not looked up. Romanian pluralisation is partly
regular and partly not, so treat the answer as a good guess.

Irregular plurals are exactly where rules fail: `ou` → `ouă`, `oaie` → `oi`,
`om` → `oameni`.

## Prefer attested forms when they exist

A dictionary's plural beats a computed one:

```bash
curl -s 'localhost:3000/v2/word/ou?sources=doom' \
  | jq '.entries[].inflections[] | select(.tags | index("plural"))'
```

Attested forms carry `origin: "attested"`. In `/v2`, `pluralro` output is marked
`origin: "derived"` precisely so you can tell them apart, and
[`?merge`](word-lookup.md#merge) drops a derived form when an attested one says
the same thing.

Use `/v1/pluralize` when you need an answer for a word no dictionary covers.
Use `/v2/word` when correctness matters.
