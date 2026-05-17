import { serve } from '@hono/node-server';
import { buildApp } from './app.js';
import { openDatabase, sweepExpired } from './cache/sqlite.js';
import { loadConfig } from './config.js';
import { getLogger } from './lib/logger.js';

async function main(): Promise<void> {
  const cfg = loadConfig();
  const logger = getLogger();
  openDatabase(cfg.DB_PATH);
  setInterval(
    () => {
      try {
        const removed = sweepExpired(openDatabase(cfg.DB_PATH));
        if (removed > 0) logger.info({ removed }, 'cache_sweep');
      } catch (e) {
        logger.warn({ err: String(e) }, 'cache_sweep_failed');
      }
    },
    60 * 60 * 1000,
  ).unref();

  const app = buildApp({ logger });
  serve({ fetch: app.fetch, port: cfg.PORT, hostname: cfg.HOST }, (info) => {
    logger.info({ port: info.port, host: cfg.HOST }, 'server_started');
  });
}

main().catch((e) => {
  console.error('fatal startup error', e);
  process.exit(1);
});
