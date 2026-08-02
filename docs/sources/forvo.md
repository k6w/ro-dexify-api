# Forvo

Crowd-sourced human pronunciation recordings.

- Site: <https://forvo.com>
- Licence: **proprietary**; per-clip credit to the speaker
- Cache: 90 days · Rate limit: 200 ms
- Provider id: `forvo`
- **Disabled unless `FORVO_API_KEY` is set**

## You probably want `/v1/tts` instead

[`/v1/tts`](../api/pronunciation.md) gives human recordings from Wikimedia
Commons, free, no key, no quota, permissively licensed. Forvo is only worth
configuring if you need a word Commons does not cover.

## Setup

```bash
export FORVO_API_KEY=your-key-here
export FORVO_DAILY_QUOTA=500      # optional; default 500
```

Then:

```bash
curl -s 'localhost:3000/v1/audio/casă' | jq
```

Without a key the endpoint returns `PROVIDER_DISABLED`.

## Quota

Forvo's free tier is limited. Requests are counted per day in the local database
and stop at `FORVO_DAILY_QUOTA`, returning `RATE_LIMITED` rather than burning
through your allowance.

## What it gives

`pronunciations[]` entries with `audioUrl`, `audioMime` and `audioAttribution`.
No definitions, it is an audio source.

## Licensing

Forvo audio is **not** freely licensed. Each clip credits its speaker in
`audioAttribution`. Check Forvo's terms before redistributing.

## Testing

The parser is tested against Forvo's documented response shape rather than a
recorded fixture, because the API needs a paid key. The tests say so explicitly.
If you have a key, record a real response and switch them over.
