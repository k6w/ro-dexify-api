/**
 * Record live upstream responses as test fixtures.
 *
 * The fixtures this replaces were hand-written toy documents totalling 1,532
 * bytes across all five files, while the real pages run 20 KB - 395 KB and use
 * entirely different markup. Parsers tested against them passed while producing
 * garbage against the live sites, so every fixture here is real recorded bytes.
 *
 * Politeness: dexonline's robots.txt sets `Crawl-delay: 2`, so requests are
 * serialised per host with a configurable minimum interval. Expect this script
 * to take a few minutes -- that is deliberate, not a hang.
 *
 * Usage:
 *   pnpm fixtures:refresh                  # all sources, all words
 *   pnpm fixtures:refresh -- --source doom # one source
 *   pnpm fixtures:refresh -- --word casă   # one word
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fetchText } from '../src/http/client.js';
import { getLogger } from '../src/lib/logger.js';
import { asciiFold } from '../src/lib/headword.js';
import { buildDexonlineJsonUrl, buildDexonlineUrl } from '../src/providers/dexonline/url.js';
import { buildDoomUrl } from '../src/providers/doom/url.js';
import { buildMdexUrl } from '../src/providers/mdex/url.js';
import { buildWiktionaryUrl } from '../src/providers/wiktionary/url.js';

/**
 * Corpus chosen to exercise the cases that actually break parsers, not just
 * happy paths. Each entry documents why it is here.
 */
const FIXTURE_WORDS: Array<{ word: string; why: string }> = [
  { word: 'casă', why: 'homonyms (casă^1..^3); DOOM result list contaminated by proper nouns' },
  { word: 'merge', why: 'irregular verb; 78 DEX definitions' },
  { word: 'gândac-de-casă', why: 'hyphenated multi-word lemma' },
  { word: 'oaie', why: 'irregular plural (oi)' },
  { word: 'ou', why: 'irregular neuter plural (ouă)' },
  { word: 'copil', why: 'diminutive/augmentative relations in the meaning tree' },
  { word: 'casa', why: 'diacritic-less query -- must still resolve' },
  { word: 'zzzqqq', why: 'not a word -- 404 / empty-result path' },
];

const FIXTURE_DIR = resolve('tests/fixtures');
const UA = 'ro-dexify-api/2.0 (+fixture-refresh; non-commercial)';

interface Source {
  dir: string;
  ext: 'html' | 'json';
  host: string;
  /** Minimum gap between requests to this host, in ms. */
  minIntervalMs: number;
  build: (word: string) => string;
}

const SOURCES: Source[] = [
  // dexonline robots.txt: Crawl-delay: 2
  {
    dir: 'dexonline',
    ext: 'json',
    host: 'dexonline.ro',
    minIntervalMs: 2000,
    build: buildDexonlineJsonUrl,
  },
  {
    dir: 'dexonline-html',
    ext: 'html',
    host: 'dexonline.ro',
    minIntervalMs: 2000,
    build: buildDexonlineUrl,
  },
  { dir: 'doom', ext: 'html', host: 'doom.lingv.ro', minIntervalMs: 1500, build: buildDoomUrl },
  { dir: 'mdex', ext: 'html', host: 'm.dex.ro', minIntervalMs: 1500, build: buildMdexUrl },
  {
    dir: 'wiktionary',
    ext: 'json',
    host: 'ro.wiktionary.org',
    minIntervalMs: 250,
    build: buildWiktionaryUrl,
  },
];

interface ManifestEntry {
  word: string;
  why: string;
  provider: string;
  file: string;
  url: string;
  status: number;
  bytes: number;
  sha256: string;
  contentType?: string;
  recordedAt: string;
}

/**
 * Filename-safe slug: fixtures must not depend on filesystem Unicode handling
 * (macOS normalises to NFD, Linux does not, and git records whatever it is
 * given).
 *
 * Folding alone collides -- `casă` and `casa` are both in the corpus precisely
 * because they must resolve differently, and both fold to "casa". When folding
 * is lossy, a short digest of the original word is appended so the two stay
 * distinct and the name stays stable across runs.
 */
function slug(word: string): string {
  const folded =
    asciiFold(word)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'word';
  if (folded === word) return folded;
  const digest = createHash('sha256').update(word.normalize('NFC')).digest('hex').slice(0, 6);
  return `${folded}-${digest}`;
}

const lastHitAt = new Map<string, number>();

async function politeDelay(host: string, minIntervalMs: number): Promise<void> {
  const last = lastHitAt.get(host);
  if (last !== undefined) {
    const wait = last + minIntervalMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }
  lastHitAt.set(host, Date.now());
}

function parseArgs(argv: string[]): { source?: string; word?: string } {
  const out: { source?: string; word?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--source' && argv[i + 1]) out.source = argv[++i];
    if (argv[i] === '--word' && argv[i + 1]) out.word = argv[++i];
  }
  return out;
}

async function main(): Promise<void> {
  const logger = getLogger();
  const args = parseArgs(process.argv.slice(2));

  const sources = args.source ? SOURCES.filter((s) => s.dir === args.source) : SOURCES;
  const words = args.word ? FIXTURE_WORDS.filter((w) => w.word === args.word) : FIXTURE_WORDS;
  if (sources.length === 0) throw new Error(`unknown --source ${args.source}`);
  if (words.length === 0) throw new Error(`unknown --word ${args.word}`);

  const manifest: ManifestEntry[] = [];
  let failures = 0;

  for (const src of sources) {
    const outDir = resolve(FIXTURE_DIR, src.dir);
    await mkdir(outDir, { recursive: true });
    for (const { word, why } of words) {
      const url = src.build(word);
      await politeDelay(src.host, src.minIntervalMs);
      logger.info({ provider: src.dir, word, url }, 'fetching');
      try {
        const r = await fetchText({
          url,
          headers: { 'user-agent': UA, accept: '*/*', 'accept-language': 'ro,en;q=0.7' },
          retries: 1,
          logger,
        });
        const name = `${slug(word)}.${src.ext}`;
        const file = resolve(outDir, name);
        await writeFile(file, r.body, 'utf8');
        manifest.push({
          word,
          why,
          provider: src.dir,
          file: `${src.dir}/${name}`,
          url,
          status: r.status,
          bytes: Buffer.byteLength(r.body, 'utf8'),
          sha256: createHash('sha256').update(r.body).digest('hex'),
          ...(r.contentType ? { contentType: r.contentType } : {}),
          recordedAt: new Date().toISOString(),
        });
        logger.info({ file: `${src.dir}/${name}`, status: r.status, bytes: r.body.length }, 'wrote');
      } catch (e) {
        failures++;
        logger.error({ err: String(e), provider: src.dir, word }, 'fetch_failed');
      }
    }
  }

  manifest.sort((a, b) => a.file.localeCompare(b.file));
  await writeFile(
    resolve(FIXTURE_DIR, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );

  logger.info({ recorded: manifest.length, failures }, 'fixtures_refreshed');
  if (failures > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
