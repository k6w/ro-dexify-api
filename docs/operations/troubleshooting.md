# Troubleshooting

## The server will not start

**`Could not locate the bindings file`** — `better-sqlite3`'s native module was
not built. pnpm blocks postinstall scripts by default.

```bash
pnpm install        # pnpm-workspace.yaml allows the needed builds
pnpm approve-builds # if it still fails
```

**`ENOENT … migrations`** — the migration SQL is missing from `dist/`. Use
`pnpm build`, which copies it; `tsc` alone does not.

**`Invalid configuration`** — an environment variable failed validation. The
message names it. See [Configuration](configuration.md).

## Empty or thin results

**Check `errors` and the breakers:**

```bash
curl -s 'localhost:3000/v1/word/casă' | jq '.errors'
curl -s 'localhost:3000/v1/sources'   | jq '.sources[] | select(.breakerState != "closed")'
```

An open breaker means a provider failed five times running and is being skipped
for 60 seconds.

**`entries` empty but `errors` has a 404** — usually the word does not exist
upstream. Try a different spelling, or with diacritics.

**Fewer entries than expected** — the default is ranked, deduplicated and capped.
Try `?all`:

```bash
curl -s 'localhost:3000/v1/word/casă?sources=dexonline&all' | jq '.entries|length'
```

**A word you know exists returns nothing** — some providers are off by default.
`mdex` needs `?sources=mdex`, `forvo` needs a key, `dlr` cannot work at all
([why](../sources/dlr.md)).

## Everything is slow

A DEXonline cache miss is ~2.5 s by design — it fetches twice, 2 s apart, to
respect `Crawl-delay: 2`. Subsequent requests for that word are milliseconds.

If it stays slow, you may be missing the cache every time. Check
`cache.misses`, and make sure `DB_PATH` points somewhere writable and
persistent — in Docker, that it is on a mounted volume.

## Wikimedia returns 403

Set a descriptive `USER_AGENT`. Wikimedia rejects generic or missing ones. This
affects both Wiktionary and Commons audio, and presents as those sources
returning nothing at all.

## Audio problems

**Wrong voice** — synthesis is female by default, but a *human recording* is
whoever recorded the word and `?voice` cannot change that. For a guaranteed
consistent voice:

```bash
curl -s 'localhost:3000/v1/tts/casă?engine=espeak' -o casa.wav
```

**Headers look mangled** — `X-Audio-*` values are percent-encoded, because HTTP
headers are ASCII and IPA is not. Decode them, or use `?meta`.

**Piper is not being used** — expected. Its only Romanian voice is male, so it
runs only for `?voice=male`, and only when `PIPER_BIN` and `PIPER_MODEL` both
point at files that exist.

## Search finds nothing

Search only covers **cached** entries. Seed the database or look words up first:

```bash
pnpm bootstrap --lite
```

## Results look wrong

Check whether the value is attested or derived:

```bash
curl -s 'localhost:3000/v2/word/<word>?merge' \
  | jq '.entries[0].inflections[] | { form, origin, confidence }'
```

Derived values come from rules and can be wrong — particularly stress and
irregular conjugation. See [Accuracy](../data/accuracy.md).

## Reporting a bug

Include the `requestId` from the error response; it correlates with the log line.

```bash
curl -s 'localhost:3000/v1/word/…' | jq '.error.requestId'
```
