# Deployment

## Build and run

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

`pnpm build` compiles TypeScript **and copies the migration SQL** into `dist/`.
`tsc` alone does not copy non-TypeScript files, and the server cannot start
without those migrations.

## Docker

A `Dockerfile` is included.

```bash
docker build -t ro-dexify-api .
docker run -p 3000:3000 \
  -e USER_AGENT="my-app/1.0 (+https://example.com; non-commercial)" \
  -v ro-dexify-data:/data \
  -e DB_PATH=/data/vocabulary.db \
  ro-dexify-api
```

**Mount a volume for `DB_PATH`.** Without one, every restart loses the cache and
re-fetches everything, which is slow and impolite to the upstream sites.

## Native dependencies

`better-sqlite3` compiles a native module. pnpm 10+ blocks postinstall scripts
by default; `pnpm-workspace.yaml` lists the allowed builds. If you see
*"Could not locate the bindings file"*, the build was skipped — run
`pnpm install` again, or `pnpm approve-builds`.

## Seeding in production

```bash
pnpm bootstrap --lite --no-install
```

Or ship without a seed (`--no-seed`) and let the cache fill from live traffic.
The first request for each word will be slower.

## Health checks

```yaml
livenessProbe:
  httpGet: { path: /v1/healthz, port: 3000 }
```

`/v1/healthz` does not touch the network, so an upstream outage cannot fail it.
It reports `degraded` when a circuit breaker is open — the service is still
usable then, so do not treat `degraded` as a restart signal.

## Logging

Structured JSON (pino) on stdout. Every request gets a `requestId` that also
appears in error responses.

```bash
LOG_LEVEL=warn    # quieter
LOG_LEVEL=debug   # includes upstream fetches
```

## Disk

| Path | Size | Notes |
|---|---|---|
| `vocabulary.db` | 3 MB (lite) → several hundred MB (full) | Grows as the cache fills |
| `.cache/tts/` | a few KB per word | Safe to delete |
| `.cache/voices/` | ~60 MB | Only if you ran `pnpm voices` |

## Scaling

The service is stateless apart from SQLite. For more than one instance, either
give each its own database file (they will each fill their own cache) or put
them behind a shared volume — SQLite in WAL mode tolerates multiple readers and
one writer.

## Upstream drift

Dictionary sites redesign without warning. A nightly job runs the parsers against
the real sites and fails if the markup changed:

```bash
pnpm check:live
```

Worth running on a schedule. See [Testing](../contributing/testing.md).
