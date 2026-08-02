/**
 * Install the Piper neural voice — model and runtime, end to end.
 *
 *   pnpm voices
 *
 * Optional: /v1/tts works without it using espeak-ng. This gets you the neural
 * tier, which sounds markedly better. Everything lands under `.cache/`, which is
 * gitignored, and `piperConfig()` looks there by default — so no environment
 * variables are needed afterwards.
 *
 * Why pip rather than the official binary: the upstream macOS release
 * (piper_macos_aarch64.tar.gz, 2023.11.14-2) ships the executable without its
 * own libespeak-ng and libonnxruntime dylibs, so it fails at load with
 * "Library not loaded: @rpath/libespeak-ng.1.dylib". The `piper-tts` wheel
 * bundles working dependencies on every platform, so it is what this uses.
 */
import { spawnSync } from 'node:child_process';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const MODEL_BASE = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/ro/ro_RO/mihai/medium';
const MODEL_FILES = ['ro_RO-mihai-medium.onnx', 'ro_RO-mihai-medium.onnx.json'];
const VOICES_DIR = resolve('.cache/voices');
const VENV_DIR = resolve('.cache/piper-venv');

const venvBin = (): string =>
  process.platform === 'win32'
    ? join(VENV_DIR, 'Scripts', 'piper.exe')
    : join(VENV_DIR, 'bin', 'piper');

function run(cmd: string, args: string[]): { ok: boolean; output: string } {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  return { ok: r.status === 0, output: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
}

function findPython(): string | undefined {
  for (const c of ['python3', 'python']) {
    if (run(c, ['--version']).ok) return c;
  }
  return undefined;
}

function indent(text: string): string {
  return text
    .split('\n')
    .slice(-6)
    .map((l) => `      ${l}`)
    .join('\n');
}

async function downloadModel(name: string): Promise<void> {
  const target = join(VOICES_DIR, name);
  try {
    const existing = await stat(target);
    if (existing.size > 0) {
      console.log(`  ${name} — already present (${(existing.size / 1e6).toFixed(1)} MB)`);
      return;
    }
  } catch {
    // Not downloaded yet.
  }

  console.log(`  ${name} — downloading…`);
  const res = await fetch(`${MODEL_BASE}/${name}?download=true`, {
    headers: { 'user-agent': 'ro-dexify-api/2.0 (+voice-download)' },
  });
  if (!res.ok || !res.body) throw new Error(`${name}: HTTP ${res.status}`);

  await mkdir(dirname(target), { recursive: true });
  await pipeline(
    Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]),
    createWriteStream(target),
  );
  const written = await stat(target);
  console.log(`  ${name} — ${(written.size / 1e6).toFixed(1)} MB`);
}

function installRuntime(): boolean {
  if (existsSync(venvBin())) {
    console.log('  piper runtime — already installed');
    return true;
  }
  if (run('piper', ['--help']).ok) {
    console.log('  piper runtime — found on PATH');
    return true;
  }

  const python = findPython();
  if (!python) {
    console.log('  piper runtime — SKIPPED: no python3 on PATH');
    return false;
  }

  console.log(`  piper runtime — creating venv with ${python}…`);
  const venv = run(python, ['-m', 'venv', VENV_DIR]);
  if (!venv.ok) {
    console.log(`  piper runtime — SKIPPED: venv failed\n${indent(venv.output)}`);
    return false;
  }

  const pip =
    process.platform === 'win32'
      ? join(VENV_DIR, 'Scripts', 'pip.exe')
      : join(VENV_DIR, 'bin', 'pip');

  console.log('  piper runtime — pip install piper-tts (this takes a minute)…');
  const install = run(pip, ['install', '--quiet', 'piper-tts']);
  if (!install.ok || !existsSync(venvBin())) {
    console.log(`  piper runtime — SKIPPED: install failed\n${indent(install.output)}`);
    return false;
  }

  console.log('  piper runtime — installed');
  return true;
}

/** Synthesise one word, so success is proven rather than assumed. */
function verify(): boolean {
  const bin = existsSync(venvBin()) ? venvBin() : 'piper';
  const model = join(VOICES_DIR, MODEL_FILES[0] ?? '');
  const out = join(VOICES_DIR, '.selftest.wav');

  const r = spawnSync(bin, ['--model', model, '--output_file', out], {
    input: 'casă\n',
    encoding: 'utf8',
  });
  if (r.status !== 0 || !existsSync(out)) {
    console.log(`  self-test — FAILED\n${indent(`${r.stdout ?? ''}${r.stderr ?? ''}`)}`);
    return false;
  }
  console.log('  self-test — synthesised "casă" successfully');
  return true;
}

async function main(): Promise<void> {
  console.log('Installing the Piper Romanian voice (ro_RO-mihai-medium)\n');

  await mkdir(VOICES_DIR, { recursive: true });
  for (const f of MODEL_FILES) await downloadModel(f);

  const ok = installRuntime() && verify();

  console.log('');
  if (ok) {
    console.log('Done. Piper is ready — no environment variables needed.');
    console.log('');
    console.log("  curl -s 'localhost:3000/v1/tts/casă?engine=piper' -o piper.wav");
    console.log('');
    console.log('Note: ro_RO-mihai-medium is the only Romanian voice Piper publishes,');
    console.log('and it is male. The default female voice stays on espeak-ng.');
  } else {
    console.log('Piper could not be set up. /v1/tts still works — it falls back to');
    console.log('espeak-ng, which needs no installation.');
    console.log('');
    console.log('To install the runtime yourself:');
    console.log('  pip install piper-tts     # then re-run `pnpm voices`');
    console.log('or point at an existing install:');
    console.log('  export PIPER_BIN=/path/to/piper');
    console.log(`  export PIPER_MODEL="${join(VOICES_DIR, MODEL_FILES[0] ?? '')}"`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
