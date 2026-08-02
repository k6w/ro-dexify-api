# Rate limits & robots.txt

This API is a guest on other people's servers. Being a well-behaved one is not
optional, and several defaults exist for that reason rather than for performance.

## Outbound rate limits

Per host, not per request. Parallel lookups queue rather than flood.

| Provider | Min interval | Concurrency |
|---|---|---|
| `dexonline` | 2000 ms | 1 |
| `mdex` | 2000 ms | 1 |
| `doom` | 1500 ms | 1 |
| `dlr` | 3000 ms | 1 |
| `wiktionary` | 250 ms | 4 |
| `forvo` | 200 ms | 2 |
| `conjugare`, `pluralro` | 0 | unlimited (local) |

DEXonline's 2000 ms is its `robots.txt` `Crawl-delay: 2`: not a guess.

**Please do not lower these.** Generous caching (see
[Caching](caching.md)) means they rarely matter in practice.

## robots.txt

Fetched per host, cached 24 hours, and honoured for every page-scraping
provider. A disallowed path yields `PROVIDER_BLOCKED_BY_ROBOTS` rather than a
request.

## The one exemption

`wiktionary` is marked `robotsPolicy: 'official-api'` and skips the check.

Wikimedia's `robots.txt` disallows `/w/` and `/api/`, which covers `api.php`.
Those rules stop search engines indexing dynamic duplicates of wiki content;
`api.php` is the interface Wikimedia publishes for programmatic access and
rate-limits itself. Using a documented API is not crawling.

The exemption is narrow, that one endpoint, and the User-Agent and rate limit
still apply. It is the only one, and a test asserts that every page-scraping
provider stays on the default crawler policy.

Wikimedia Commons audio lookups go through the same documented API and the same
reasoning.

If you disagree with the interpretation, set the provider's `robotsPolicy` back
to `'crawler'`. It will then be blocked, and Wiktionary data will be
unavailable.

## User-Agent

`USER_AGENT` should identify your deployment and offer a contact:

```
my-app/1.0 (+https://example.com/contact; non-commercial)
```

**Wikimedia returns 403 without a descriptive User-Agent.** This is enforced,
not advisory, a generic or missing UA means every Wikimedia request fails.

## Circuit breakers

Five consecutive failures open a provider's breaker for 60 seconds. Requests
skip it instead of retrying into a struggling server.

Visible in [`/v1/sources`](../api/sources.md) as `breakerState`.

## Inbound rate limiting

`RATE_LIMIT_PER_MIN` (default 60) limits clients of *your* deployment.
Exceeding it returns `429 RATE_LIMITED`.

## Timeouts

8 s per provider, 12 s total. A slow source is abandoned and reported in
`errors`; the rest of the response still arrives.
