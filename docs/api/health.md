# Health

```
GET /v1/healthz
```

```bash
curl -s 'localhost:3000/v1/healthz' | jq
```

```json
{ "status": "ok", "uptime": 12.5, "db": "ok", "breakers": {} }
```

| Field | Meaning |
|---|---|
| `status` | `ok` or `degraded` |
| `uptime` | Seconds since start |
| `db` | `ok` if the database answers |
| `breakers` | Providers whose circuit breaker is not closed |

`degraded` means the service is running but something is unhappy — usually one
or more open breakers. Lookups still work with the remaining sources.

Suitable for a container liveness probe. It does not touch the network, so it
stays fast and cannot be made to fail by an upstream outage.

For provider-level detail use [`/v1/sources`](sources.md).
