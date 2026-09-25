import { afterEach, describe, expect, it } from 'vitest';
import {
  NO_DATABASE_MESSAGE,
  createTestSchema,
  hasTestDatabase,
  testSchemaName,
} from './postgres';

/**
 * The harness isolates suites from each other. These assert that property
 * directly, because everything else in the database suites depends on it and
 * a collision surfaces as unrelated flakiness rather than as a clear failure.
 */
describe('test schema isolation', () => {
  describe('schema naming', () => {
    it('carries a per-run token, not the suite name alone', () => {
      // A shared database — a Neon branch used by two checkouts, or a
      // developer and CI at once — would otherwise give both runs
      // `test_migrations`, and the second DROP SCHEMA CASCADE would delete
      // the first one's tables mid-test.
      expect(testSchemaName('migrations')).toMatch(/^test_migrations_.+/);
      expect(testSchemaName('migrations')).not.toBe('test_migrations');
    });

    it('gives the same suite the same name within one process', () => {
      // Teardown must be able to find what setup created.
      expect(testSchemaName('migrations')).toBe(testSchemaName('migrations'));
    });

    it('gives different suites different names', () => {
      expect(testSchemaName('migrations')).not.toBe(testSchemaName('text_search'));
    });

    it('needs no quoting, because identifiers cannot be parameterised', () => {
      // Anything outside this set would have to be quoted in every statement
      // naming the schema, and the first one forgotten is a runtime error.
      expect(testSchemaName('Odd Name-With.Punctuation')).toMatch(/^[a-z0-9_]+$/);
    });
  });

  const describeWithDatabase = hasTestDatabase() ? describe : describe.skip;

  if (!hasTestDatabase()) {
    console.warn(`\n[postgres.test] ${NO_DATABASE_MESSAGE}\n`);
  }

  describeWithDatabase('against a real database', () => {
    const cleanups: Array<() => Promise<void>> = [];

    afterEach(async () => {
      for (const drop of cleanups.splice(0)) await drop();
    });

    it("does not see another schema's tables", async () => {
      const a = await createTestSchema('iso_a');
      const b = await createTestSchema('iso_b');
      cleanups.push(a.drop, b.drop);

      await a.pool.query('CREATE TABLE only_in_a (id int)');

      // b's search_path points at its own schema, so the table is invisible
      // even though both pools share one database.
      const { rows } = await b.pool.query<{ found: boolean }>(
        `SELECT to_regclass('only_in_a') IS NOT NULL AS found`,
      );

      expect(rows[0]?.found).toBe(false);
    });

    it('drops only its own schema', async () => {
      const a = await createTestSchema('iso_keep');
      const b = await createTestSchema('iso_go');
      cleanups.push(a.drop);

      await a.pool.query('CREATE TABLE survivor (id int)');
      await b.drop();

      const { rows } = await a.pool.query<{ found: boolean }>(
        `SELECT to_regclass('survivor') IS NOT NULL AS found`,
      );

      expect(rows[0]?.found).toBe(true);
    });
  });
});
