import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards the auth schema duplicated in the reader app's adapter test.
 *
 * `apps/web/src/auth/adapter.test.ts` creates the auth tables itself, because
 * `@scrinode/web` may not depend on `@scrinode/api` (AGENTS.md §8). That
 * duplicate is only useful while it matches migration 0003 — a copy that
 * drifts would let the adapter tests pass against a schema production does
 * not have, which is the exact failure the tests exist to prevent.
 *
 * So rather than compare SQL text, which differs harmlessly in whitespace,
 * this asserts the decisions that actually matter are present in both.
 */
describe('auth schema stays in step with the reader app', () => {
  const migration = readFileSync(join(__dirname, '0003-auth-tables.ts'), 'utf8');

  const adapterTest = readFileSync(
    join(__dirname, '../../../../web/src/auth/adapter.test.ts'),
    'utf8',
  );

  /**
   * Each entry is a decision that the adapter depends on, written so it
   * appears in both files. A future edit to one file that drops one of these
   * fails here.
   */
  const decisions: readonly [string, string][] = [
    ['uuid primary keys', 'uuid PRIMARY KEY DEFAULT gen_random_uuid()'],
    ['cascade from users to accounts', 'REFERENCES users (id) ON DELETE CASCADE'],
    ['unique email', 'CREATE UNIQUE INDEX users_email_unique ON users (email)'],
    ['unique session token', 'CREATE UNIQUE INDEX sessions_token_unique ON sessions ("sessionToken")'],
    ['quoted userId column', '"userId"'],
    ['quoted emailVerified column', '"emailVerified"'],
    ['quoted providerAccountId column', '"providerAccountId"'],
    ['verification token composite key', 'PRIMARY KEY (identifier, token)'],
  ];

  for (const [description, fragment] of decisions) {
    it(`declares ${description} in the migration`, () => {
      expect(migration).toContain(fragment);
    });

    it(`declares ${description} in the adapter test`, () => {
      expect(adapterTest).toContain(fragment);
    });
  }

  it('creates the same four tables in both', () => {
    // The adapter issues raw SQL against these names; a rename breaks
    // sign-in with no type error to catch it first.
    for (const table of ['users', 'accounts', 'sessions', 'verification_token']) {
      expect(migration).toContain(`CREATE TABLE ${table} (`);
      expect(adapterTest).toContain(`CREATE TABLE ${table} (`);
    }
  });
});
