import type { PoolClient } from 'pg';
import type { Migration } from '../migration.types';

/**
 * Reader identity tables, owned by the Auth.js PostgreSQL adapter.
 *
 * AGENTS.md §27.1 — READER identity only. Admin identity is a separate
 * security domain with its own tables (`admin_users`, created in migration
 * 0001), its own session cookie and its own domain (§27.2, §27.3). Nothing
 * here may be reused for admin auth, and no privilege column may ever be
 * added to `users`.
 *
 * The column names are the adapter's, not ours. It issues raw SQL against
 * `users`, `accounts`, `sessions` and `verification_token` with quoted
 * camelCase columns (`"userId"`, `"emailVerified"`, `"sessionToken"`), so
 * these identifiers cannot be renamed to match Scrinode's snake_case
 * convention without breaking sign-in. Verified against @auth/pg-adapter
 * 1.11.3.
 *
 * Two deliberate departures from the schema Auth.js documents:
 *
 *   1. `id` is `uuid`, not `SERIAL`. The adapter never supplies an id — every
 *      insert omits the column and uses RETURNING — so the type is ours to
 *      choose. Sequential integers are enumerable, and a reader id reaches
 *      URLs and API responses.
 *
 *   2. Foreign keys are `ON DELETE CASCADE`. The adapter's own `deleteUser`
 *      deletes the user row *before* its sessions and accounts, which plain
 *      foreign keys would reject. Cascade makes that order work and
 *      guarantees no orphaned session outlives its user — a session row
 *      pointing at a deleted user is an authentication hazard, not untidiness.
 */
export const migration0003: Migration = {
  version: 3,
  name: 'auth-tables',

  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE users (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name            varchar(255),
        email           varchar(255),
        "emailVerified" timestamptz,
        image           text
      )
    `);

    // Email is the identity for magic-link sign-in and the join key when a
    // reader later adds an OAuth provider. Two rows sharing one address would
    // silently split one person's library in two.
    //
    // Unique rather than NOT NULL: the adapter's type allows a null email,
    // and Postgres treats nulls as distinct in a unique index, so both
    // constraints hold together.
    await client.query('CREATE UNIQUE INDEX users_email_unique ON users (email)');

    await client.query(`
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
      )
    `);

    // One account per provider identity. Without this, a repeated OAuth
    // callback links the same Google account twice.
    await client.query(`
      CREATE UNIQUE INDEX accounts_provider_unique
        ON accounts (provider, "providerAccountId")
    `);

    await client.query('CREATE INDEX accounts_user_idx ON accounts ("userId")');

    await client.query(`
      CREATE TABLE sessions (
        id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId"       uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        expires        timestamptz NOT NULL,
        "sessionToken" varchar(255) NOT NULL
      )
    `);

    // Every session lookup is by token, on every authenticated request. This
    // is the hottest index in the reader app.
    await client.query(`
      CREATE UNIQUE INDEX sessions_token_unique ON sessions ("sessionToken")
    `);

    await client.query('CREATE INDEX sessions_user_idx ON sessions ("userId")');

    // Magic-link and email-verification tokens. The adapter deletes a token
    // as it consumes it; expired ones are swept separately.
    await client.query(`
      CREATE TABLE verification_token (
        identifier text        NOT NULL,
        expires    timestamptz NOT NULL,
        token      text        NOT NULL,

        PRIMARY KEY (identifier, token)
      )
    `);

    // Supports sweeping expired tokens without scanning the table.
    await client.query(
      'CREATE INDEX verification_token_expires_idx ON verification_token (expires)',
    );
  },

  async down(client: PoolClient): Promise<void> {
    // Reverse creation order: accounts and sessions reference users.
    await client.query('DROP TABLE IF EXISTS verification_token');
    await client.query('DROP TABLE IF EXISTS sessions');
    await client.query('DROP TABLE IF EXISTS accounts');
    await client.query('DROP TABLE IF EXISTS users');
  },
};
