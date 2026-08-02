# Testing

```bash
pnpm test           # 312 tests
pnpm test:ci        # + a guard that the suite actually ran
pnpm typecheck
pnpm lint
pnpm check:live     # hits the real dictionary sites
```

## Golden fixtures

Parsers are tested against **recorded responses from the live sites**, in
`tests/fixtures/`. Forty files across eight words and five endpoints.

This matters more than it sounds. The parsers were originally tested against
hand-written sample documents that resembled the real pages only loosely. Every
test passed while every parser produced garbage against the actual sites — a
DOOM lookup returned the headword `s.` and the inflection `art.`.

Fixtures are recorded, never written by hand:

```bash
pnpm fixtures:refresh                    # everything
pnpm fixtures:refresh -- --source doom   # one source
pnpm fixtures:refresh -- --word casă     # one word
```

The recorder rate-limits per host and writes `tests/fixtures/manifest.json` with
each file's URL, HTTP status, byte count and SHA-256, so upstream drift shows up
as a reviewable diff.

### The corpus

Chosen for the cases that break parsers, not happy paths:

| Word | Why |
|---|---|
| `casă` | homonyms; the result list is contaminated by proper nouns |
| `merge` | irregular verb, 78 DEX definitions |
| `gândac-de-casă` | hyphenated multi-word lemma |
| `oaie`, `ou` | irregular plurals |
| `copil` | relation-heavy entry |
| `casa` | diacritic-less query |
| `zzzqqq` | not a word — the 404 path |

## Test layout

```
tests/
  providers/    one file per provider, asserting against fixtures
  extract/      the parsing primitives
  phonetics/    G2P vs the IPA Wiktionary recorded
  schema/       v1 <-> v2 adapters
  server/       view, merge, phonetics enrichment
  routes/       endpoint behaviour
  tts/          synthesis and the audio endpoint
```

`tests/helpers.ts` has `fixture(provider, word)` and `firstOrThrow(list)`.

## Writing a test

**Every defect becomes a named failing test first, then goes green.** Several
existing tests read as regressions with the cause in a comment, because that is
what they are:

```ts
it('does not turn the parenthetical proper-noun note into plural forms', () => {
  // Regression: splitting "pl. case (dar: Casa Corpului Didactic, ...)" on
  // "," emitted case, dar:, Casa, Corpului and Didactic all as plurals.
  …
});
```

Assert against real fixture bytes, not constructed input, wherever the code
parses something.

## The CI guard

`vitest run` exits 0 even when every test file fails to load and nothing runs.
That is how the suite once "passed" with zero tests executed.

`pnpm test:ci` reads vitest's JSON report and fails unless a real number of tests
passed. Raise the threshold as the suite grows; never lower it to make a red
build green.

## Live drift check

```bash
pnpm check:live
```

Fetches each source for real and asserts the same invariants the golden tests do:
DOOM still yields `casă` with stress and `case`/`casei`; DEXonline still ranks
DEX '09 first with numbered senses and an etymology; Wiktionary still gives
substantiv/feminin with IPA and 6+ declension forms.

Runs nightly in CI, deliberately **not** in the PR gate — it makes real network
requests and a third-party outage must not block a merge.

When it fails, re-record fixtures and read the diff:

```bash
pnpm fixtures:refresh
git diff tests/fixtures/manifest.json
```

## Determinism

Tests must not depend on the network. The TTS tests use `?engine=espeak` so they
never call Commons; the Commons path is covered by `check:live` instead.
