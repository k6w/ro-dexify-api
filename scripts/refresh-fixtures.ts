import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fetchText } from '../src/http/client.js';
import { buildDoomUrl } from '../src/providers/doom/url.js';
import { buildDexonlineUrl } from '../src/providers/dexonline/url.js';
import { buildMdexUrl } from '../src/providers/mdex/url.js';
import { buildWiktionaryUrl } from '../src/providers/wiktionary/url.js';
import { getLogger } from '../src/lib/logger.js';

const FIXTURE_WORDS = ['casa', 'merge'];
const FIXTURE_DIR = resolve('tests/fixtures');
const UA = 'ro-dexify-api/2.0 (+fixture-refresh; non-commercial)';

interface Source {
  dir: string;
  ext: 'html' | 'json';
  build: (word: string) => string;
}

const SOURCES: Source[] = [
  { dir: 'doom', ext: 'html', build: buildDoomUrl },
  { dir: 'dexonline', ext: 'html', build: buildDexonlineUrl },
  { dir: 'mdex', ext: 'html', build: buildMdexUrl },
  { dir: 'wiktionary', ext: 'json', build: buildWiktionaryUrl },
];

async function main(): Promise<void> {
  const logger = getLogger();
  for (const src of SOURCES) {
    const outDir = resolve(FIXTURE_DIR, src.dir);
    await mkdir(outDir, { recursive: true });
    for (const word of FIXTURE_WORDS) {
      const url = src.build(word);
      logger.info({ provider: src.dir, word, url }, 'fetching');
      try {
        const r = await fetchText({
          url,
          headers: { 'user-agent': UA, accept: '*/*' },
          retries: 1,
          ...(logger ? { logger } : {}),
        });
        const file = resolve(outDir, `${word}.${src.ext}`);
        await writeFile(file, r.body, 'utf8');
        logger.info({ file, status: r.status }, 'wrote_fixture');
      } catch (e) {
        logger.error({ err: String(e), provider: src.dir, word }, 'fetch_failed');
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
