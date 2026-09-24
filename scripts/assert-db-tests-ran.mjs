#!/usr/bin/env node
/**
 * Fails the build if the database integration suites were skipped.
 *
 * A skipped suite and a passing suite look identical in a CI summary: both
 * are green. These suites cover migrations, the Auth.js adapter schema and
 * accent-insensitive search — the parts most likely to break silently — and
 * they skip themselves when TEST_DATABASE_URL is unset, which is right
 * locally and unacceptable in CI.
 *
 * An earlier version of this check lived inline in the workflow and grepped
 * vitest's stdout for `"numPendingTests":0`. The JSON reporter writes to a
 * *file* and prints only its path, so the grep never matched and the check
 * failed unconditionally — including when the database was healthy. It is a
 * script now so it can be run and proven outside CI.
 *
 *   node scripts/assert-db-tests-ran.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Every suite that needs a database, and the package that owns it.
 *
 * Listed explicitly rather than discovered: a suite that stops requiring a
 * database should be removed from here deliberately, and a new one that
 * needs one must be added, which a glob would hide.
 */
const SUITES = [
  ['@scrinode/api', 'src/database/migration.runner.test.ts'],
  ['@scrinode/api', 'src/database/migrations/migrations.test.ts'],
  ['@scrinode/api', 'src/database/migrations/text-search.test.ts'],
  ['@scrinode/web', 'src/auth/adapter.test.ts'],
];

if (!process.env.TEST_DATABASE_URL) {
  console.error('TEST_DATABASE_URL is not set. These suites would skip.');
  process.exit(1);
}

const outputDir = mkdtempSync(join(tmpdir(), 'scrinode-dbcheck-'));
let failed = false;

try {
  for (const [pkg, suite] of SUITES) {
    const outFile = join(outputDir, `${suite.replace(/[^a-z0-9]/gi, '_')}.json`);

    try {
      execFileSync(
        'pnpm',
        [
          '--filter',
          pkg,
          'exec',
          'vitest',
          'run',
          suite,
          '--reporter=json',
          `--outputFile=${outFile}`,
        ],
        { stdio: 'pipe', shell: process.platform === 'win32' },
      );
    } catch {
      // A failing test is reported by the verify step, which runs first.
      // This check is only about whether the tests ran at all, and the
      // report is still written when they fail.
    }

    let report;

    try {
      report = JSON.parse(readFileSync(outFile, 'utf8'));
    } catch {
      console.error(`FAIL  ${suite} — vitest wrote no report; the suite did not run`);
      failed = true;
      continue;
    }

    const { numTotalTests = 0, numPendingTests = 0, numPassedTests = 0 } = report;

    if (numTotalTests === 0) {
      console.error(`FAIL  ${suite} — no tests collected`);
      failed = true;
    } else if (numPendingTests > 0) {
      console.error(
        `FAIL  ${suite} — ${numPendingTests} of ${numTotalTests} skipped; ` +
          'TEST_DATABASE_URL is not reaching Postgres',
      );
      failed = true;
    } else {
      console.log(`ok    ${suite} — ${numPassedTests}/${numTotalTests} ran`);
    }
  }
} finally {
  rmSync(outputDir, { recursive: true, force: true });
}

if (failed) {
  console.error(
    '\nDatabase integration tests did not run. They skip silently when the\n' +
      'database is unreachable, so CI treats that as a failure.',
  );
  process.exit(1);
}

console.log('\nAll database integration suites ran.');
