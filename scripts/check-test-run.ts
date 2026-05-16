/**
 * Fail the build when the test suite did not actually execute.
 *
 * `vitest run` exits 0 even when every test file fails to load and all tests
 * are skipped -- measured: with src/cache/migrations/ removed, 13 test files
 * errored, 59 tests were skipped, and the exit code was still 0. CI was
 * therefore green while nothing ran at all.
 *
 * This reads vitest's JSON report and asserts that a real number of tests
 * passed. Raise MIN_PASSING_TESTS as the suite grows; never lower it to make a
 * red build green.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIN_PASSING_TESTS = 45;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reportPath = join(root, '.vitest-report.json');

if (!existsSync(reportPath)) {
  console.error(
    `check-test-run: no report at ${reportPath}. Run: vitest run --reporter=json --outputFile=.vitest-report.json`,
  );
  process.exit(1);
}

interface VitestReport {
  success?: boolean;
  numTotalTests?: number;
  numPassedTests?: number;
  numFailedTests?: number;
  numPendingTests?: number;
  numTotalTestSuites?: number;
}

let report: VitestReport;
try {
  report = JSON.parse(readFileSync(reportPath, 'utf8')) as VitestReport;
} catch (err) {
  console.error(`check-test-run: report is not valid JSON: ${(err as Error).message}`);
  process.exit(1);
}

const passed = report.numPassedTests ?? 0;
const failed = report.numFailedTests ?? 0;
const skipped = report.numPendingTests ?? 0;
const total = report.numTotalTests ?? 0;

console.log(
  `check-test-run: ${passed} passed, ${failed} failed, ${skipped} skipped, ${total} total`,
);

const problems: string[] = [];
if (report.success === false) problems.push('vitest reported success=false');
if (failed > 0) problems.push(`${failed} test(s) failed`);
if (passed < MIN_PASSING_TESTS) {
  problems.push(
    `only ${passed} test(s) passed, expected at least ${MIN_PASSING_TESTS} -- the suite did not really run`,
  );
}

if (problems.length > 0) {
  for (const p of problems) console.error(`check-test-run: FAIL - ${p}`);
  process.exit(1);
}

console.log('check-test-run: OK');
