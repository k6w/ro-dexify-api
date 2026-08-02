# Search

```
GET /v1/search?q=<query>&limit=20&offset=0
```

Full-text search across **cached** entries.

```bash
curl -s 'localhost:3000/v1/search?q=locuință&limit=3' | jq
```

```json
{
  "query": "locuință",
  "count": 3,
  "results": [
    {
      "headword": "CASĂ",
      "providerId": "dexonline",
      "preview": "Clădire care servește drept locuință.",
      "score": -1.88e-6
    }
  ]
}
```

## It only searches what you already have

Search reads the local database. A word nobody has looked up and the seed did
not include will not be found, search does not go to the internet.

To fill the index: run `pnpm bootstrap --lite` (or `--full`), and/or look words
up via `/v1/word/…`, which caches as it goes.

## Diacritics do not matter

The index folds them, so an unaccented query finds accented words:

```bash
curl -s 'localhost:3000/v1/search?q=casa'      # finds casă
curl -s 'localhost:3000/v1/search?q=locuinta'  # finds locuință
```

Useful when typing `ă â î ș ț` is awkward. It works in both directions.

## Prefix matching

Every term is matched as a prefix, so `cas` finds `casă`, `casnic` and
`căsătorie`. There is no way to disable this currently.

## Special characters are safe

The underlying engine (SQLite FTS5) has its own query language where `AND`,
`OR`, `NOT`, `NEAR`, `:`, `^` and `*` are operators. Passing them through would
let a search either mean something surprising or crash.

Every term is quoted before it reaches the engine, so operators are searched as
ordinary text:

```bash
curl -s 'localhost:3000/v1/search?q=AND OR NOT'   # 0 results, no error
curl -s 'localhost:3000/v1/search?q=a*b"OR'       # 200, no error
curl -s 'localhost:3000/v1/search?q=^^^'          # 200, empty
```

A query that reduces to nothing returns an empty result, never a 500.

## `score`

BM25 relevance from SQLite. **Lower is better**: the values are negative and
more-negative means more relevant. Results are already ordered, so you can
usually ignore it.

## Paging

`limit` 1–100 (default 20), `offset` from 0.

```bash
curl -s 'localhost:3000/v1/search?q=casa&limit=10&offset=10'
```

There is no total count. Request one more than you need to know if more exist.
