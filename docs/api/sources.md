# Sources endpoint

```
GET /v1/sources
```

Lists every provider, what it can do, and whether it is currently healthy.

```bash
curl -s 'localhost:3000/v1/sources' | jq '.sources[] | { id, enabled, breakerState }'
```

```json
{ "id": "doom",       "enabled": true,  "breakerState": "closed" }
{ "id": "dexonline",  "enabled": true,  "breakerState": "closed" }
{ "id": "mdex",       "enabled": false, "breakerState": "closed" }
```

## Fields

| Field | Meaning |
|---|---|
| `id` | What you pass to `?sources=` |
| `name` | Human name |
| `homepage` | The upstream site |
| `license` | Licence of that source's data |
| `attribution` | Credit line, also on every entry |
| `capabilities` | What it provides: see below |
| `ttlSeconds` | How long its answers are cached |
| `rateLimitMs` | Minimum gap between requests to this source |
| `enabled` | Whether it is used by default |
| `breakerState` | `closed` (healthy), `open` (failing), `half-open` (retrying) |

## `capabilities`

`definitions`, `etymology`, `examples`, `inflections`, `conjugation`,
`pluralization`, `pronunciation_text`, `pronunciation_audio`, `register_notes`.

Usable as a filter: `/v1/word/casă?include=definitions`.

## `breakerState`

Each provider has a circuit breaker. After 5 consecutive failures it opens for
60 seconds, and requests skip that provider instead of waiting for it to time
out again.

- **`closed`**: normal.
- **`open`**: failing; being skipped. Lookups still work, with fewer sources.
- **`half-open`**: trying one request to see if it recovered.

An `open` breaker is the first thing to check if results suddenly got thinner.
See [Troubleshooting](../operations/troubleshooting.md).

## Why `enabled` is false for some

- `mdex`: mirrors DEXonline in poorer markup; enabling it duplicates every
  definition. Reachable with `?sources=mdex`.
- `forvo`: needs `FORVO_API_KEY`.
- `dlr`: upstream no longer exists. See [DLR](../sources/dlr.md).
