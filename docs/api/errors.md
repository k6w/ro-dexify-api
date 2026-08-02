# Errors

Two different things are called "errors" here, and mixing them up causes
confusion.

## 1. Request errors — an HTTP error status

The request itself was wrong or could not be served.

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "…",
    "requestId": "01KZ1FHX3FWVR50NK2D4FTPM1R"
  }
}
```

| Code | Status | Meaning |
|---|---|---|
| `INVALID_INPUT` | 400 | Word failed validation, or an unknown provider id |
| `WORD_NOT_FOUND` | 404 | Nothing could be produced (e.g. a non-verb sent to `/v1/conjugate`) |
| `RATE_LIMITED` | 429 | You exceeded the inbound rate limit, or a provider quota |
| `PROVIDER_DISABLED` | 503 | You asked for a provider that is off (e.g. Forvo without a key) |
| `INTERNAL` | 500 | A bug. `requestId` correlates with the server log. |

`requestId` appears in both the response and the log line, so quote it when
reporting a problem.

## 2. Provider errors — inside a `200` response

A lookup asks several dictionaries at once. Some may fail. That is normal and
does **not** fail the request:

```json
{
  "headword": "zzzqqq",
  "entries": [ … ],
  "cache": { "hits": 0, "misses": 1 },
  "errors": [
    { "providerId": "dexonline", "code": "PROVIDER_UPSTREAM_ERROR", "message": "dexonline returned HTTP 404" }
  ]
}
```

| Code | Meaning |
|---|---|
| `PROVIDER_UPSTREAM_ERROR` | The site returned an error — often just "no such word" |
| `PROVIDER_TIMEOUT` | Too slow (8 s per provider, 12 s total) |
| `PROVIDER_BLOCKED_BY_ROBOTS` | `robots.txt` disallows that path |
| `PROVIDER_DISABLED` | Named in `?sources=` but not enabled |

### How to treat these

**Check `entries` first, not `errors`.** Non-empty `entries` with non-empty
`errors` means some sources worked: the response is usable.

- `entries` non-empty → use them.
- `entries` empty, `errors` non-empty → likely an unknown word, or upstream
  trouble. Retry later.
- both empty → the word is valid but nothing was found.

A 404 from DEXonline for a made-up word is the correct answer to a correct
question, and it surfaces here rather than being hidden — which is deliberate,
but does mean `errors` is not automatically a problem.

## Timeouts

8 seconds per provider, 12 seconds total. One slow dictionary cannot hold up the
rest: whatever finished in time is returned, and the slow one appears in
`errors`. Both configurable — see [Configuration](../operations/configuration.md).
