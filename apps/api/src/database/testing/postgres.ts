import { Pool } from 'pg';

/**
 * Connecting integration tests to a real PostgreSQL.
 *
 * MongoDB tests used `mongodb-memory-server`, which downloaded a real server
 * and needed nothing else installed. Postgres has no equivalent that also
 * carries pgvector:
 *
 *   - `pg-mem` reimplements Postgres in JavaScript and has no pgvector, so
 *     a vector test would pass against a query the real database rejects
 *   - `embedded-postgres` ships real binaries but no extensions
 *   - testcontainers needs Docker, and pulls `ssh2` and native bindings for
 *     remote-host support this project does not use
 *
 * So these tests use whatever Postgres the environment provides, and skip —
 * loudly — when there is none. A skipped test is honest; a test passing
 * against a fake engine is not.
 *
 * Locally:  docker compose up -d postgres
 * In CI:    a service container (see .github/workflows/ci.yml)
 */

/**
 * Connection string for tests.
 *
 * `TEST_DATABASE_URL` is separate from `DATABASE_URL` on purpose: these
 * tests create and drop schemas, and pointing them at a development database
 * by accident should not be possible through a variable that is already set
 * for other reasons.
 */
export function testDatabaseUrl(): string | undefined {
  return process.env.TEST_DATABASE_URL;
}

/** Whether integration tests can run here. */
export function hasTestDatabase(): boolean {
  return Boolean(testDatabaseUrl());
}

/**
 * The message shown when tests skip.
 *
 * Spelled out rather than left as a bare skip: a developer seeing "0 tests"
 * should learn why and how to fix it, not assume the suite is empty.
 */
export const NO_DATABASE_MESSAGE =
  'TEST_DATABASE_URL is not set, so database integration tests are skipped.\n' +
  '  Start one with:  docker compose up -d postgres\n' +
  '  Then:            TEST_DATABASE_URL=postgres://scrinode:scrinode_dev_password@localhost:5432/scrinode_dev';

/**
 * A token distinguishing this run from any other sharing the database.
 *
 * GITHUB_RUN_ID is stable across a workflow's jobs and unique per run, so
 * two concurrent CI runs differ. Off CI there is no such identifier, so the
 * process id plus a random suffix stands in: it need only be unique among
 * runs alive at the same time, since each is dropped at teardown.
 *
 * Computed once per process. Calling it per suite would give each its own
 * token, which still isolates but makes an abandoned schema impossible to
 * attribute to a run.
 */
let cachedRunToken: string | undefined;

function runToken(): string {
  if (cachedRunToken) return cachedRunToken;

  const ci = process.env.GITHUB_RUN_ID;
  const attempt = process.env.GITHUB_RUN_ATTEMPT;

  cachedRunToken = ci
    ? `r${ci}${attempt ? `a${attempt}` : ''}`
    : `p${process.pid}${Math.random().toString(36).slice(2, 6)}`;

  return cachedRunToken;
}

/**
 * The schema name a suite gets.
 *
 * Exported so the isolation property can be tested without opening a
 * connection. Schema names are identifiers and cannot be parameterised, so
 * both parts are restricted to characters that need no quoting rather than
 * escaped — an unquoted identifier is also folded to lower case by Postgres,
 * which §24 requires everywhere.
 */
export function testSchemaName(name: string): string {
  const safe = (value: string) => value.replace(/[^a-z0-9_]/gi, '_').toLowerCase();

  return `test_${safe(name)}_${safe(runToken())}`;
}

/**
 * Open a pool against an isolated schema.
 *
 * Each suite gets its own schema, and `search_path` points at it, so tables
 * created with unqualified names land there. Two suites running in parallel
 * therefore cannot collide on a table name, and cleanup is one DROP SCHEMA
 * rather than a list of tables that drifts as the schema grows.
 *
 * The schema name also carries a per-run token, because the suite name alone
 * is only unique within one run. CI's Postgres is a per-job service container
 * and cannot be shared, but a *managed* database can be: point two checkouts,
 * or a developer and a CI run, at one Neon branch and both would compute
 * `test_migrations` — and the second DROP SCHEMA CASCADE would delete the
 * first one's tables mid-test. The failure would look like flakiness rather
 * than a collision, which is the kind of thing that gets retried instead of
 * fixed.
 */
export async function createTestSchema(name: string): Promise<{
  pool: Pool;
  drop: () => Promise<void>;
}> {
  const connectionString = testDatabaseUrl();

  if (!connectionString) {
    throw new Error('createTestSchema called without TEST_DATABASE_URL');
  }

  const schema = testSchemaName(name);

  const pool = new Pool({
    connectionString,
    max: 4,
    // Every connection from this pool works inside the suite's schema.
    options: `-c search_path=${schema},public`,
  });

  pool.on('error', () => {
    // Tests tear pools down abruptly; an idle-client error during teardown
    // is noise, and an unhandled 'error' event would fail the run.
  });

  // Created through a connection of its own, because the pool's search_path
  // refers to a schema that does not exist yet.
  const setup = new Pool({ connectionString, max: 1 });

  try {
    await setup.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await setup.query(`CREATE SCHEMA ${schema}`);
  } finally {
    await setup.end();
  }

  return {
    pool,

    drop: async () => {
      await pool.end();

      const teardown = new Pool({ connectionString, max: 1 });

      try {
        await teardown.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      } finally {
        await teardown.end();
      }
    },
  };
}
