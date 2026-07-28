/**
 * Download the Piper Romanian voice.
 *
 * Optional: /v1/tts works without it, using espeak-ng. This fetches the model
 * that makes the synthesised tier sound natural instead of robotic.
 *
 *   pnpm voices
 *   export PIPER_MODEL="$PWD/.cache/voices/ro_RO-mihai-medium.onnx"
 *   export PIPER_BIN=/usr/local/bin/piper   # from rhasspy/piper releases
 *
 * The binary is not downloaded here: it is platform-specific and the operator
 * should get it from the project's own releases.
 */
import { createWriteStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const BASE = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/ro/ro_RO/mihai/medium';
const FILES = ['ro_RO-mihai-medium.onnx', 'ro_RO-mihai-medium.onnx.json'];
const OUT_DIR = resolve('.cache/voices');

async function download(name: string): Promise<void> {
  const target = join(OUT_DIR, name);
  try {
    const existing = await stat(target);
    if (existing.size > 0) {
      console.log(`voices: ${name} already present (${(existing.size / 1e6).toFixed(1)} MB)`);
      return;
    }
  } catch {
    // Not downloaded yet.
  }

  const url = `${BASE}/${name}?download=true`;
  console.log(`voices: downloading ${name}`);
  const res = await fetch(url, {
    headers: { 'user-agent': 'ro-dexify-api/2.0 (+voice-download)' },
  });
  if (!res.ok || !res.body) {
    throw new Error(`voices: ${name} failed with HTTP ${res.status}`);
  }

  await mkdir(dirname(target), { recursive: true });
  await pipeline(
    Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]),
    createWriteStream(target),
  );
  const written = await stat(target);
  console.log(`voices: ${name} -> ${target} (${(written.size / 1e6).toFixed(1)} MB)`);
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  for (const f of FILES) await download(f);
  console.log(
    [
      '',
      'Done. To use it:',
      `  export PIPER_MODEL="${join(OUT_DIR, FILES[0] ?? '')}"`,
      '  export PIPER_BIN=/path/to/piper        # github.com/rhasspy/piper/releases',
      '',
      'Without these, /v1/tts falls back to espeak-ng and still works.',
    ].join('\n'),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
