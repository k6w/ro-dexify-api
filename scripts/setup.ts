import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { closeDatabase, openDatabase } from '../src/cache/sqlite.js';
import { loadConfig } from '../src/config.js';
import { getLogger } from '../src/lib/logger.js';
import { downloadDump } from '../src/seed/download.js';
import { importDexDump } from '../src/seed/import.js';

interface Flags {
  full: boolean;
  refresh: boolean;
  noSeed: boolean;
  noInstall: boolean;
  keepDump: boolean;
  dbPath: string | undefined;
}

function parseFlags(argv: string[]): Flags {
  const f: Flags = {
    full: false,
    refresh: false,
    noSeed: false,
    noInstall: false,
    keepDump: false,
    dbPath: undefined,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--full') f.full = true;
    else if (a === '--lite') f.full = false;
    else if (a === '--refresh') f.refresh = true;
    else if (a === '--no-seed') f.noSeed = true;
    else if (a === '--no-install') f.noInstall = true;
    else if (a === '--keep-dump') f.keepDump = true;
    else if (a === '--db' && argv[i + 1]) {
      f.dbPath = argv[++i];
    }
  }
  return f;
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const cfg = loadConfig();
  const logger = getLogger();

  const major = Number(process.versions.node.split('.')[0]);
  if (Number.isFinite(major) && major < 20) {
    throw new Error(`Node >= 20 required (got ${process.versions.node})`);
  }

  if (!flags.noInstall) {
    logger.info('running pnpm install --frozen-lockfile');
    try {
      execSync('pnpm install --frozen-lockfile', { stdio: 'inherit' });
    } catch (e) {
      logger.warn({ err: String(e) }, 'pnpm install fallback to non-frozen');
      execSync('pnpm install', { stdio: 'inherit' });
    }
  }

  const dbPath = flags.dbPath ?? cfg.DB_PATH;
  const db = openDatabase(dbPath);
  logger.info({ dbPath }, 'database_ready');

  if (flags.noSeed) {
    logger.info('skipping seed (--no-seed)');
    closeDatabase();
    return;
  }

  const cacheDir = resolve('.cache');
  const dumpPath = resolve(cacheDir, 'dex-dump.sql.gz');
  const needsDownload = flags.refresh || !existsSync(dumpPath);
  if (needsDownload) {
    logger.info({ url: cfg.DEX_DUMP_URL, dumpPath }, 'downloading_dump');
    await downloadDump({
      url: cfg.DEX_DUMP_URL,
      destination: dumpPath,
      resume: !flags.refresh,
      logger,
    });
  } else {
    logger.info({ dumpPath }, 'using_cached_dump');
  }

  logger.info({ mode: flags.full ? 'full' : 'lite' }, 'importing_dump');
  const summary = await importDexDump({
    dumpPath,
    database: db,
    mode: flags.full ? 'full' : 'lite',
    logger,
  });
  logger.info(summary, 'import_summary');

  if (!flags.keepDump) {
    await unlink(dumpPath).catch(() => undefined);
    logger.info('dump_removed');
  }

  try {
    db.prepare('SELECT 1').get();
    logger.info('healthcheck_ok');
  } catch (e) {
    logger.error({ err: String(e) }, 'healthcheck_failed');
    process.exitCode = 1;
  }
  closeDatabase();
}

main().catch((e) => {
  console.error('setup failed', e);
  process.exit(1);
});
