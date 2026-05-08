import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { closeDatabase, openDatabase } from '../src/cache/sqlite.js';
import { clearMem } from '../src/cache/memory.js';
import { resetConfigForTests } from '../src/config.js';
import { clearRobotsCacheForTests } from '../src/http/robots.js';

let tmp: string | undefined;

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), 'ro-dexify-test-'));
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'silent';
  process.env.DB_PATH = join(tmp, 'vocabulary.db');
  resetConfigForTests();
  openDatabase(process.env.DB_PATH);
});

afterEach(() => {
  clearMem();
  clearRobotsCacheForTests();
});

afterAll(() => {
  closeDatabase();
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});
