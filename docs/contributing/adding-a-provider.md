# Adding a provider

The order matters: **record real bytes before writing a parser.** Writing the
parser first against an imagined page is how this project ended up with green
tests and broken parsers.

## 1. Look at the real thing

```bash
curl -sS -A "ro-dexify-api/2.0 (+research)" 'https://example.ro/dictionar/casă' -o /tmp/x.html
less /tmp/x.html
```

Answer these before writing code:

- Is there a JSON API? Prefer it. DEXonline's is far more reliable than its HTML.
- What does `robots.txt` say? Any `Crawl-delay`?
- Does it need a User-Agent? (Wikimedia 403s without one.)
- What is in the **markup** rather than the prose? DOOM's stress is an underline
  span; flattening to text destroys it.
- What does it do for an unknown word?

## 2. Record fixtures

Add the source to `scripts/refresh-fixtures.ts`:

```ts
{ dir: 'example', ext: 'html', host: 'example.ro', minIntervalMs: 1500, build: buildExampleUrl },
```

```bash
pnpm fixtures:refresh -- --source example
```

## 3. Write the failing test

Assert what the fixture actually contains, exact forms, exact counts:

```ts
it('extracts exactly the real inflections', () => {
  const e = firstOrThrow(parseExample(fixture('example', 'casă'), 'casă'), 'entry');
  expect(e.inflections.map((i) => i.form).sort()).toEqual(['case', 'casei']);
});
```

Commit it failing. That is the record of what was wrong.

## 4. Write the parser

`src/providers/example/{index,url,parse}.ts`.

Reuse the primitives rather than reinventing them:

| Need | Use |
|---|---|
| POS, gender, register from abbreviations | `extract/abbrev.ts`: `readGrammar()` |
| Splitting on `,`/`;` without breaking parentheses | `extract/segment.ts` |
| Lemma vs homonym index | `lib/headword.ts`: `splitHomonym()` |
| DEXonline markup | `extract/internal-rep.ts` |
| MediaWiki markup | `extract/wikitext.ts` |

Do not add a fifth private part-of-speech table. There used to be four, and the
same word came back `substantiv` from one provider and `unknown` from another.

## 5. Register it

```ts
readonly meta: ProviderMeta = {
  id: 'example',
  name: 'Example Dictionary',
  homepage: 'https://example.ro',
  license: 'CC-BY-SA-4.0',
  attribution: 'Example contributors',
  capabilities: new Set(['definitions']),
  ttlSeconds: TTL_SECONDS.example,
  rateLimit: { minIntervalMs: 1500, concurrency: 1 },
  enabled: true,
};
```

Add the id to `ProviderId` in `src/schema/entry.ts`, a TTL in `cache/ttl.ts`,
and the class to `providers/registry.ts`.

## 6. Extend the drift check

Add invariants to `scripts/check-live.ts` so a redesign is caught nightly.

## 7. Documentation

Add `docs/sources/example.md` and a row in `docs/sources/README.md`. Say what it
provides, what it does **not**, and any caveat you found.

## Rules

- **Never invent data.** Omit what you cannot read. If a rule produces it, mark
  it `origin: 'derived'`.
- **Respect robots.txt.** The only exemption is documented in
  [Rate limits & robots](../operations/rate-limits-robots.md), and it is for a
  documented API, not a scraped page.
- **Record licence and attribution.** They travel on every entry.
- **Handle the empty case.** `parse('')` returns `[]`; an unknown word returns
  `[]`, not a throw.
