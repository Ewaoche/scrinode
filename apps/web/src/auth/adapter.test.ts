import PostgresAdapter from '@auth/pg-adapter';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Verifies the Auth.js PostgreSQL adapter against Scrinode's actual schema.
 *
 * This matters more than a version-compatibility check. Migration 0003
 * departs from the schema Auth.js documents in two ways — `uuid` ids rather
 * than `SERIAL`, and `ON DELETE CASCADE` on the foreign keys — because the
 * adapter never supplies an id and its own `deleteUser` removes the user row
 * before its sessions.
 *
 * Both departures are judgements about code we do not control. These tests
 * exercise the adapter's real operations against the real schema, so a wrong
 * judgement fails here rather than on a reader's first sign-in.
 *
 * Skipped when no database is configured. Start one with
 * `docker compose up -d postgres` and set TEST_DATABASE_URL.
 */
const connectionString = process.env.TEST_DATABASE_URL;

const describeWithDatabase = connectionString ? describe : describe.skip;

if (!connectionString) {
  console.warn(
    '\n[adapter.test] TEST_DATABASE_URL is not set, so Auth.js adapter tests are skipped.' +
      '\n  docker compose up -d postgres' +
      '\n  TEST_DATABASE_URL=postgres://scrinode:scrinode_dev_password@localhost:5432/scrinode_dev\n',
  );
}

/**
 * The auth schema, as migration 0003 creates it.
 *
 * Duplicated here rather than imported: `@scrinode/web` may not depend on
 * `@scrinode/api` (AGENTS.md §8). A drift between the two would make these
 * tests pass against a schema production does not have, so
 * `auth-schema.test.ts` in the API asserts the two agree.
 */
const SCHEMA = `
  CREATE TABLE users (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            varchar(255),
    email           varchar(255),
    "emailVerified" timestamptz,
    image           text
  );

  CREATE UNIQUE INDEX users_email_unique ON users (email);

  CREATE TABLE accounts (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId"            uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type                varchar(255) NOT NULL,
    provider            varchar(255) NOT NULL,
    "providerAccountId" varchar(255) NOT NULL,
    refresh_token       text,
    access_token        text,
    expires_at          bigint,
    id_token            text,
    scope               text,
    session_state       text,
    token_type          text
  );

  CREATE UNIQUE INDEX accounts_provider_unique
    ON accounts (provider, "providerAccountId");

  CREATE TABLE sessions (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId"       uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    expires        timestamptz NOT NULL,
    "sessionToken" varchar(255) NOT NULL
  );

  CREATE UNIQUE INDEX sessions_token_unique ON sessions ("sessionToken");

  CREATE TABLE verification_token (
    identifier text        NOT NULL,
    expires    timestamptz NOT NULL,
    token      text        NOT NULL,
    PRIMARY KEY (identifier, token)
  );
`;

describeWithDatabase('Auth.js PostgreSQL adapter against Scrinode\'s schema', () => {
  const schema = 'test_auth_adapter';

  let pool: Pool;
  let adapter: ReturnType<typeof PostgresAdapter>;

  beforeAll(async () => {
    const setup = new Pool({ connectionString, max: 1 });

    try {
      await setup.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await setup.query(`CREATE SCHEMA ${schema}`);
    } finally {
      await setup.end();
    }

    // Unqualified names in the adapter's SQL resolve to this schema.
    pool = new Pool({
      connectionString,
      max: 4,
      options: `-c search_path=${schema},public`,
    });

    pool.on('error', () => {
      // Teardown closes pools abruptly; an idle-client error is noise here
      // and an unhandled 'error' event would fail the run.
    });

    await pool.query(SCHEMA);

    adapter = PostgresAdapter(pool);
  }, 60_000);

  afterAll(async () => {
    await pool.end();

    const teardown = new Pool({ connectionString, max: 1 });

    try {
      await teardown.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    } finally {
      await teardown.end();
    }
  });

  it('creates and reads a user', async () => {
    const created = await adapter.createUser!({
      id: '',
      email: 'reader@scrinode.com',
      emailVerified: null,
    });

    expect(created.email).toBe('reader@scrinode.com');

    const fetched = await adapter.getUser!(created.id);
    expect(fetched?.email).toBe('reader@scrinode.com');
  });

  it('generates a uuid rather than a sequential id', async () => {
    // The schema departs from Auth.js's documented SERIAL here: a reader id
    // reaches URLs, and sequential integers make the user base enumerable.
    const created = await adapter.createUser!({
      id: '',
      email: 'uuid@scrinode.com',
      emailVerified: null,
    });

    expect(created.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('finds a user by email', async () => {
    await adapter.createUser!({
      id: '',
      email: 'byemail@scrinode.com',
      emailVerified: null,
    });

    const found = await adapter.getUserByEmail!('byemail@scrinode.com');
    expect(found?.email).toBe('byemail@scrinode.com');
  });

  it('returns null for an unknown email', async () => {
    expect(await adapter.getUserByEmail!('nobody@scrinode.com')).toBeNull();
  });

  it('links an OAuth account and finds the user by it', async () => {
    const user = await adapter.createUser!({
      id: '',
      email: 'google@scrinode.com',
      emailVerified: null,
    });

    await adapter.linkAccount!({
      userId: user.id,
      type: 'oauth',
      provider: 'google',
      providerAccountId: 'google-123',
    });

    const found = await adapter.getUserByAccount!({
      provider: 'google',
      providerAccountId: 'google-123',
    });

    expect(found?.id).toBe(user.id);
  });

  it('creates a session and resolves it back to its user', async () => {
    const user = await adapter.createUser!({
      id: '',
      email: 'session@scrinode.com',
      emailVerified: null,
    });

    const expires = new Date(Date.now() + 60_000);
    await adapter.createSession!({
      sessionToken: 'token-abc',
      userId: user.id,
      expires,
    });

    const result = await adapter.getSessionAndUser!('token-abc');

    expect(result?.user.id).toBe(user.id);
    expect(result?.session.sessionToken).toBe('token-abc');
  });

  it('deletes a session', async () => {
    const user = await adapter.createUser!({
      id: '',
      email: 'signout@scrinode.com',
      emailVerified: null,
    });

    await adapter.createSession!({
      sessionToken: 'token-del',
      userId: user.id,
      expires: new Date(Date.now() + 60_000),
    });

    await adapter.deleteSession!('token-del');

    expect(await adapter.getSessionAndUser!('token-del')).toBeNull();
  });

  it('deletes a user together with their sessions and accounts', async () => {
    // The adapter deletes the user row *before* its sessions and accounts.
    // Without ON DELETE CASCADE the foreign keys would reject that first
    // statement, and deleting an account would be impossible.
    const user = await adapter.createUser!({
      id: '',
      email: 'delete-me@scrinode.com',
      emailVerified: null,
    });

    await adapter.linkAccount!({
      userId: user.id,
      type: 'oauth',
      provider: 'google',
      providerAccountId: 'google-delete',
    });

    await adapter.createSession!({
      sessionToken: 'token-cascade',
      userId: user.id,
      expires: new Date(Date.now() + 60_000),
    });

    await adapter.deleteUser!(user.id);

    expect(await adapter.getUser!(user.id)).toBeNull();

    // A session outliving its user would authenticate a deleted account.
    const { rows } = await pool.query<{ count: string }>(
      `SELECT count(*) AS count FROM sessions WHERE "userId" = $1`,
      [user.id],
    );
    expect(Number(rows[0]?.count)).toBe(0);
  });

  it('stores and consumes a verification token exactly once', async () => {
    const expires = new Date(Date.now() + 60_000);

    await adapter.createVerificationToken!({
      identifier: 'magic@scrinode.com',
      token: 'magic-token',
      expires,
    });

    const used = await adapter.useVerificationToken!({
      identifier: 'magic@scrinode.com',
      token: 'magic-token',
    });

    expect(used?.identifier).toBe('magic@scrinode.com');

    // A magic link must not be replayable.
    const reused = await adapter.useVerificationToken!({
      identifier: 'magic@scrinode.com',
      token: 'magic-token',
    });

    expect(reused).toBeNull();
  });
});
