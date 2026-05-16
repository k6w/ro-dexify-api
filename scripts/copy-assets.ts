/**
 * Copy non-TypeScript build assets from src/ into dist/.
 *
 * `tsc` only emits .js for .ts inputs, so src/cache/migrations/*.sql never
 * reached dist/ and `pnpm build && pnpm start` died on ENOENT inside
 * applyMigrations(). Node-only and cross-platform, matching the project's
 * no-shell-tooling constraint.
 */
import { cpSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const ASSET_DIRS = [join('src', 'cache', 'migrations')];

let copied = 0;
for (const rel of ASSET_DIRS) {
  const from = join(root, rel);
  const to = join(root, rel.replace(/^src/, 'dist'));
  if (!existsSync(from)) {
    throw new Error(`copy-assets: expected asset directory is missing: ${rel}`);
  }
  const files = readdirSync(from).filter((f) => f.endsWith('.sql'));
  if (files.length === 0) {
    throw new Error(`copy-assets: no .sql files found in ${rel}`);
  }
  cpSync(from, to, { recursive: true });
  copied += files.length;
  console.log(`copy-assets: ${rel} -> ${rel.replace(/^src/, 'dist')} (${files.length} file(s))`);
}

console.log(`copy-assets: ${copied} asset(s) copied`);
