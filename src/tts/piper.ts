/**
 * Piper neural TTS — optional, and off unless configured.
 *
 * `ro_RO-mihai-medium` is a real Romanian voice and sounds far better than
 * espeak, but it needs a ~60 MB ONNX model and the Piper binary. Bundling
 * onnxruntime would add roughly 100 MB to every install for a tier most
 * deployments will not use, so Piper is invoked as an external process when the
 * operator has set it up and skipped silently otherwise.
 *
 *   PIPER_BIN=/usr/local/bin/piper
 *   PIPER_MODEL=/opt/voices/ro_RO-mihai-medium.onnx
 *
 * `pnpm voices` downloads the model; the binary comes from
 * https://github.com/rhasspy/piper/releases.
 *
 * Piper reads text, not IPA, so unlike the espeak tier this one cannot be fed
 * our own transcription — it uses its own Romanian front-end.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

export interface PiperResult {
  bytes: Buffer;
  mime: 'audio/wav';
  engine: 'piper';
}

export interface PiperConfig {
  bin: string;
  model: string;
}

/** Resolve the configuration, or undefined when Piper is not set up. */
export function piperConfig(env: NodeJS.ProcessEnv = process.env): PiperConfig | undefined {
  const bin = env.PIPER_BIN?.trim();
  const model = env.PIPER_MODEL?.trim();
  if (!bin || !model) return undefined;
  // Both must exist: a stale path should fall through to espeak rather than
  // fail every pronunciation request.
  if (!existsSync(bin) || !existsSync(model)) return undefined;
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
