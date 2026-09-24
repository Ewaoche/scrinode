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
 * Open a pool against an isolated schema.
 *
 * Each suite gets its own schema, and `search_path` points at it, so tables
 * created with unqualified names land there. Two suites running in parallel
 * therefore cannot collide on a table name, and cleanup is one DROP SCHEMA
 * rather than a list of tables that drifts as the schema grows.
 */
export async function createTestSchema(name: string): Promise<{
  pool: Pool;
  drop: () => Promise<void>;
}> {
  const connectionString = testDatabaseUrl();

  if (!connectionString) {
    throw new Error('createTestSchema called without TEST_DATABASE_URL');
  }

  // Schema names are identifiers and cannot be parameterised, so the name is
  // restricted to characters that need no quoting rather than escaped.
  const schema = `test_${name.replace(/[^a-z0-9_]/gi, '_').toLowerCase()}`;

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
