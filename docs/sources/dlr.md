# DLR / TEZAUR — unavailable

**Dicționarul Limbii Române**, the Romanian Academy's thesaurus dictionary.

- Site: <https://dlr1.solirom.ro>
- Provider id: `dlr`
- **Disabled unconditionally. It cannot currently work.**

## What happened

The provider was written against:

```
https://dlr1.solirom.ro/index.php?cuv=<word>
```

That URL now returns **HTTP 404 for every word**. The site was rebuilt as a
browser-only application: it loads `minisearch` and web components and resolves
words client-side against an index hosted elsewhere.

There is no server-rendered page for a word, so there is nothing for a
server-side parser to fetch. These paths were all checked:

| Path | Result |
|---|---|
| `/index.php?cuv=casă` | 404 |
| `/casă` | 404 |
| `/search?q=casă` | 404 |
| `/data/`, `/api/` | 404 |
| the referenced backend index host | 404 |

## Why it is disabled rather than deleted

Enabling it would add a provider that fails on every request, putting a
`PROVIDER_UPSTREAM_ERROR` in every response's `errors` for no benefit.

`ENABLE_DLR=true` alone is not enough — an internal flag also has to be flipped,
and a test asserts it stays disabled. This is deliberate: the gate means "there
is no endpoint", not "the operator has not opted in".

The parser is kept in place, marked unverified. It has never been run against
real bytes and should be assumed broken.

## Reviving it

Two routes, both a real decision:

1. **A documented API from solirom.** If one appears, point the provider at it
   and verify against recorded fixtures like every other source.
2. **A headless browser.** Would work, but adds a browser as a dependency —
   a significant cost for one source.

Until then the DLR corpus is out of reach. [DEXonline](dexonline.md) includes
DLRLC and DLRM, which cover some of the same ground.
