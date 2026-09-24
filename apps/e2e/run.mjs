import { spawn } from 'node:child_process';
import { Client } from 'pg';

/**
 * Runs the E2E suite against a disposable database.
 *
 * Playwright starts its `webServer` processes before `globalSetup`, so a
 * database prepared there would come up after the apps had already failed to
 * connect. Preparing it here, before Playwright is invoked at all, removes
 * the ordering problem entirely.
 *
 * E2E must never reach production: Scrinode is production-first, and a suite
 * that can touch production data is one mistake away from destroying it.
 * MongoDB made that easy — `mongodb-memory-server` downloaded its own server
 * and there was nothing to point at by accident. Postgres has no equivalent
 * carrying pgvector, so the protection here is explicit instead:
 *
 *   - the database name must end in `_e2e`, and the suite creates and drops
 *     it on every run
 *   - a connection string with a non-local host is refused outright
 *
 * Provide a server with `E2E_DATABASE_URL`, or run `docker compose up -d
 * postgres` and accept the default.
 */

const ADMIN_URL =
  process.env.E2E_DATABASE_URL ??
  'postgres://scrinode:scrinode_dev_password@localhost:5432/postgres';

const DATABASE_NAME = 'scrinode_e2e';

/**
 * Refuse anything that is not clearly a local, disposable server.
 *
 * A remote host here would mean the suite creating and dropping a database
 * somewhere real. The check is deliberately strict: a developer whose setup
 * this rejects should have to say so explicitly.
 */
function assertLocal(url) {
  const { hostname } = new URL(url);
  const local = ['localhost', '127.0.0.1', '::1', 'postgres', 'db'];

  if (!local.includes(hostname)) {
    console.error(
      `E2E refuses to run against host "${hostname}".\n` +
        'This suite creates and drops its database on every run, so it must\n' +
        'point at a local, disposable server.',
    );
    process.exit(1);
  }
}

assertLocal(ADMIN_URL);

/** Connect to the maintenance database to create or drop the test one. */
async function admin(sql) {
  const client = new Client({ connectionString: ADMIN_URL });

  try {
    await client.connect();
    await client.query(sql);
  } finally {
    await client.end();
  }
}

const testUrl = new URL(ADMIN_URL);
testUrl.pathname = `/${DATABASE_NAME}`;

try {
  // Dropped first: a previous run that crashed leaves the database behind,
  // and reusing it would let one run's state reach the next.
  await admin(`DROP DATABASE IF EXISTS ${DATABASE_NAME} WITH (FORCE)`);
  await admin(`CREATE DATABASE ${DATABASE_NAME}`);
} catch (error) {
  console.error(
    `Could not prepare the E2E database: ${error.message}\n` +
      'Start one with:  docker compose up -d postgres',
  );
  process.exit(1);
}

// The extensions migrations rely on. Created here rather than by a migration
// because CREATE EXTENSION needs privileges the application role lacks; the
// container's init SQL does the same for the development database.
const setup = new Client({ connectionString: testUrl.toString() });

try {
  await setup.connect();
  await setup.query('CREATE EXTENSION IF NOT EXISTS vector');
  await setup.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
} finally {
  await setup.end();
}

process.env.DATABASE_URL = testUrl.toString();
process.env.DATABASE_SSL = 'false';

const playwright = spawn('npx', ['playwright', 'test', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

const exitCode = await new Promise((resolve) => {
  playwright.on('close', resolve);
});

// Dropped even when the suite failed: a leftover database would be reused by
// the next run and could mask a failure with stale state.
await admin(`DROP DATABASE IF EXISTS ${DATABASE_NAME} WITH (FORCE)`).catch(() => undefined);

process.exit(exitCode ?? 1);
