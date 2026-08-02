# Pronunciation & TTS

```
GET /v1/tts/:word           → audio bytes
GET /v1/tts/:word?meta      → JSON describing the audio
```

## Getting audio

```bash
curl -s 'localhost:3000/v1/tts/casă' -o casa.oga
afplay casa.oga          # macOS.  Linux: paplay / ffplay
```

The file may be `.oga`, `.wav` or `.mp3` depending on where it came from. Check
the `content-type` header, or ask `?meta` first.

## Knowing what you got

```bash
curl -s 'localhost:3000/v1/tts/casă?meta' | jq
```

```json
{
  "word": "casă",
  "engine": "commons",
  "mime": "application/ogg",
  "bytes": 38135,
  "license": "Public domain",
  "attribution": "Calusarul — via Wikimedia Commons (File:Ro-casă.oga)",
  "sourceUrl": "https://upload.wikimedia.org/wikipedia/commons/9/94/Ro-cas%C4%83.oga",
  "audioUrl": "/v1/tts/cas%C4%83",
  "ipa": "/ˈka.sə/",
  "syllabification": "ca-să",
  "stressOrigin": "derived"
}
```

The same information is on the audio response as headers:
`X-Audio-Engine`, `X-Audio-License`, `X-Audio-Attribution`, `X-Audio-IPA`,
`X-Audio-Voice`.

**Header values are percent-encoded.** HTTP headers are ASCII and `/ˈka.sə/` is
not, so `X-Audio-IPA` reads `%2F%CB%88ka.s%C9%99%2F`. Decode with
`decodeURIComponent`. `?meta` gives the values verbatim; prefer it if you can
make two requests.

## Where audio comes from

Three tiers, best first. The `engine` field tells you which one answered.

### 1. `commons` — a human recording

A real person, from [Wikimedia Commons](https://commons.wikimedia.org),
including the [Lingua Libre](https://lingualibre.org) corpus of 24,088 Romanian
recordings. Free, no API key.

This is the best audio available and is always preferred. Two naming patterns
are searched: `Ro-<word>.oga` and `LL-Q7913 (ron)-<speaker>-<word>.wav`.

**Licences vary per file** — `casă` is public domain, most Lingua Libre files
are CC BY-SA 4.0 — so licence and attribution are read per recording and
returned with it. If you republish the audio, honour them.

### 2. `piper` — neural synthesis, optional

Natural-sounding, but Piper's catalogue has exactly one Romanian voice
(`ro_RO-mihai-medium`) and it is **male**. It is therefore used only for
`?voice=male`, never for the default female voice.

The model is real and public: `ro_RO-mihai-medium.onnx`, 60.3 MB,
md5 `45f4253916c93d3d05ad3fe1b07ea4f3`, in
[rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices/tree/main/ro/ro_RO/mihai/medium).
It is the only Romanian voice in that catalogue.

Needs the model and the Piper binary:

```bash
pnpm voices                                   # downloads the model
export PIPER_MODEL="$PWD/.cache/voices/ro_RO-mihai-medium.onnx"
export PIPER_BIN=/usr/local/bin/piper         # github.com/rhasspy/piper/releases
```

If either path is missing or the binary fails, it silently falls through to
espeak. A broken Piper never breaks pronunciation.

### 3. `espeak` — always available

[espeak-ng](https://github.com/espeak-ng/espeak-ng) compiled to WebAssembly. No
binary to install, no model to download, works identically everywhere. It sounds
synthetic, but it is phonetically correct — and it is fed
[our own IPA](../phonetics/README.md) rather than the spelling, so it speaks the
transcription this API verified rather than guessing at Romanian orthography.

Because this tier always works, `/v1/tts` never fails for a valid word.

## Choosing a voice

**Synthesis uses a female voice by default** (espeak `ro+f3`).

```bash
curl -s 'localhost:3000/v1/tts/casă?engine=espeak'             # female (default)
curl -s 'localhost:3000/v1/tts/casă?engine=espeak&voice=male'  # male
```

| Want | Do |
|---|---|
| Best possible audio | default — you get a human where one exists |
| **A woman's voice on every word** | `?engine=espeak` |
| A man's voice | `?voice=male` |
| A different female timbre | `TTS_VOICE=ro+f5` (env) |

`?voice` affects **synthesis only**. A human recording is whoever recorded that
word — Commons publishes no speaker gender, so there is nothing to filter on and
this API does not guess it from names. `casă` is read by Calusarul and `copil`
by Andreea Teodoraa regardless of `?voice`.

**If you need one consistent voice throughout, use `?engine=espeak`.** That
skips the human tier entirely.

espeak variants: `ro+f1`…`ro+f5` female, `ro+m1`…`ro+m7` male. They share the
phoneme set, so only the timbre changes — the IPA spoken is identical. Set
`TTS_VOICE` to any of them to override the default outright.

## Caching

Audio is cached on disk under `.cache/tts/`, keyed by word **and** voice, so the
same word in two voices is two files. Delete the directory to reset.

## Forvo

`/v1/audio/:word` is a separate passthrough to [Forvo](https://forvo.com), which
needs a paid API key (`FORVO_API_KEY`). Without a key the provider is disabled
and the endpoint returns `PROVIDER_DISABLED`. Forvo audio is proprietary and
requires per-clip credit to the speaker.

Most people want `/v1/tts` instead — it is free and needs no key.
