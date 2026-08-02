/**
 * Piper neural TTS — optional, and off unless configured.
 *
 * `ro_RO-mihai-medium` is a real Romanian voice and sounds far better than
 * espeak, but it needs a ~60 MB ONNX model and the Piper binary. Bundling
 * onnxruntime would add roughly 100 MB to every install for a tier most
 * deployments will not use, so Piper is invoked as an external process when the
 * operator has set it up and skipped silently otherwise.
 *
 * `pnpm voices` installs both and puts them where this looks by default, so no
 * configuration is normally needed. To point elsewhere:
 *
 *   PIPER_BIN=/usr/local/bin/piper
 *   PIPER_MODEL=/opt/voices/ro_RO-mihai-medium.onnx
 *
 * Piper reads text, not IPA, so unlike the espeak tier this one cannot be fed
 * our own transcription — it uses its own Romanian front-end.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export interface PiperResult {
  bytes: Buffer;
  mime: 'audio/wav';
  engine: 'piper';
}

export interface PiperConfig {
  bin: string;
  model: string;
}

/**
 * Where `pnpm voices` puts things, so a normal setup needs no environment
 * variables at all. PIPER_BIN / PIPER_MODEL still win when set.
 */
const DEFAULT_BINS = [
  '.cache/piper-venv/bin/piper', // pip install piper-tts, what `pnpm voices` uses
  '.cache/piper-venv/Scripts/piper.exe', // same, on Windows
  '.cache/piper/piper/piper', // the upstream tarball, if unpacked by hand
];
const DEFAULT_MODEL = '.cache/voices/ro_RO-mihai-medium.onnx';

function firstExisting(paths: readonly string[]): string | undefined {
  for (const p of paths) {
    const abs = resolve(p);
    if (existsSync(abs)) return abs;
  }
  return undefined;
}

/**
 * Resolve the configuration, or undefined when Piper is not set up.
 *
 * Order: explicit env vars, then whatever `pnpm voices` installed. Both the
 * binary and the model must exist -- a stale path falls through to espeak
 * rather than failing every pronunciation request.
 */
export function piperConfig(env: NodeJS.ProcessEnv = process.env): PiperConfig | undefined {
  // An explicit off switch, for operators who do not want the tier and for
  // tests that must not depend on whether `pnpm voices` has been run here.
  if (env.PIPER_DISABLE === '1' || env.PIPER_DISABLE === 'true') return undefined;

  const envBin = env.PIPER_BIN?.trim();
  const envModel = env.PIPER_MODEL?.trim();

  // An explicitly set variable is never silently replaced by a discovered path:
  // if you pointed at something, a typo should surface as "not configured"
  // rather than as a different voice.
  const bin = envBin ? (existsSync(envBin) ? envBin : undefined) : firstExisting(DEFAULT_BINS);
  const model = envModel
    ? existsSync(envModel)
      ? envModel
      : undefined
    : firstExisting([DEFAULT_MODEL]);

  if (!bin || !model) return undefined;
  return { bin, model };
}

export function isPiperAvailable(env: NodeJS.ProcessEnv = process.env): boolean {
  return piperConfig(env) !== undefined;
}

/**
 * Synthesise with Piper, or return undefined if it is unavailable or fails.
 *
 * Never throws: this is a quality upgrade over espeak, and a broken install
 * must degrade rather than take pronunciation down.
 */
export async function synthesizeWithPiper(
  word: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<PiperResult | undefined> {
  const config = piperConfig(env);
  if (!config) return undefined;

  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let settled = false;
    const done = (value: PiperResult | undefined): void => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(config.bin, ['--model', config.model, '--output_file', '-'], {
        stdio: ['pipe', 'pipe', 'ignore'],
      });
    } catch {
      done(undefined);
      return;
    }

    // A hung binary must not hold the request open.
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      done(undefined);
    }, 10_000);

    child.stdout?.on('data', (c: Buffer) => chunks.push(c));
    child.on('error', () => {
      clearTimeout(timer);
      done(undefined);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const bytes = Buffer.concat(chunks);
      // Piper writes a WAV to stdout; anything else means it did not work.
      const looksLikeWav = bytes.length > 44 && bytes.toString('latin1', 0, 4) === 'RIFF';
      done(code === 0 && looksLikeWav ? { bytes, mime: 'audio/wav', engine: 'piper' } : undefined);
    });

    child.stdin?.end(`${word}\n`);
  });
}
