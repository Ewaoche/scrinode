import type { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MigrationError, MigrationRunner } from './migration.runner';
import type { Migration } from './migration.types';
import { MIGRATIONS_TABLE } from './database.constants';
import { NO_DATABASE_MESSAGE, createTestSchema, hasTestDatabase } from './testing/postgres';

/**
 * Runs against a real PostgreSQL. Transactional DDL, advisory locks and
 * ON CONFLICT behaviour cannot be verified against a mock, and the whole
 * point of the runner is that those hold.
 *
 * Skipped when no database is configured — see `testing/postgres.ts`.
 */
const describeWithDatabase = hasTestDatabase() ? describe : describe.skip;

if (!hasTestDatabase()) {
  console.warn(`\n[migration.runner.test] ${NO_DATABASE_MESSAGE}\n`);
}

describeWithDatabase('MigrationRunner', () => {
  let pool: Pool;
  let drop: () => Promise<void>;

  beforeAll(async () => {
    ({ pool, drop } = await createTestSchema('migration_runner'));
  }, 60_000);

  afterAll(async () => {
    await drop();
  });

  afterEach(async () => {
    // Between cases, clear everything the migrations under test created.
    await pool.query(`DROP TABLE IF EXISTS ${MIGRATIONS_TABLE}`);
    await pool.query('DROP TABLE IF EXISTS made_by_migration');
  });

  const record = (version: number, name: string, log: string[]): Migration => ({
    version,
    name,
    async up() {
      log.push(`up:${version}`);
    },
    async down() {
      log.push(`down:${version}`);
    },
  });

  describe('up', () => {
    it('applies a pending migration', async () => {
      const log: string[] = [];
      const applied = await new MigrationRunner(pool, [record(1, 'first', log)]).up();

      expect(log).toEqual(['up:1']);
      expect(applied).toHaveLength(1);
      expect(applied[0]?.version).toBe(1);
    });

    it('applies migrations in ascending version order', async () => {
      const log: string[] = [];
      // Deliberately registered out of order.
      const migrations = [
        record(3, 'third', log),
        record(1, 'first', log),
        record(2, 'second', log),
      ];

      await new MigrationRunner(pool, migrations).up();

      expect(log).toEqual(['up:1', 'up:2', 'up:3']);
    });

    it('is idempotent — a second run applies nothing', async () => {
      const log: string[] = [];
      const migrations = [record(1, 'first', log)];

      await new MigrationRunner(pool, migrations).up();
      const second = await new MigrationRunner(pool, migrations).up();

      expect(log).toEqual(['up:1']);
      expect(second).toHaveLength(0);
    });

    it('applies only migrations added since the last run', async () => {
      const log: string[] = [];

      await new MigrationRunner(pool, [record(1, 'first', log)]).up();
      await new MigrationRunner(pool, [record(1, 'first', log), record(2, 'second', log)]).up();

      expect(log).toEqual(['up:1', 'up:2']);
    });

    it('records each applied migration', async () => {
      await new MigrationRunner(pool, [record(1, 'first', [])]).up();

      const { rows } = await pool.query<{
        name: string;
        applied_at: Date;
        duration_ms: string;
      }>(`SELECT name, applied_at, duration_ms FROM ${MIGRATIONS_TABLE} WHERE version = 1`);

      expect(rows[0]?.name).toBe('first');
      expect(rows[0]?.applied_at).toBeInstanceOf(Date);
      expect(Number(rows[0]?.duration_ms)).toBeGreaterThanOrEqual(0);
    });

    it('stops at the first failure and does not attempt later migrations', async () => {
      const log: string[] = [];
      const failing: Migration = {
        version: 2,
        name: 'explodes',
        async up() {
          throw new Error('boom');
        },
        async down() {},
      };

      const runner = new MigrationRunner(pool, [
        record(1, 'first', log),
        failing,
        record(3, 'third', log),
      ]);

      await expect(runner.up()).rejects.toThrow(MigrationError);
      expect(log).toEqual(['up:1']);
    });

    it('does not record a migration that failed', async () => {
      const failing: Migration = {
        version: 1,
        name: 'explodes',
        async up() {
          throw new Error('boom');
        },
        async down() {},
      };

      await expect(new MigrationRunner(pool, [failing]).up()).rejects.toThrow();

      const { rows } = await pool.query<{ count: string }>(
        `SELECT count(*) AS count FROM ${MIGRATIONS_TABLE}`,
      );
      expect(Number(rows[0]?.count)).toBe(0);
    });

    it('rolls back schema changes made before a migration failed', async () => {
      // The reason migrations run in a transaction. Under MongoDB a failure
      // partway left whatever the successful statements had already done,
      // and the runner could only report it.
      const partial: Migration = {
        version: 1,
        name: 'fails-after-creating-a-table',
        async up(client) {
          await client.query('CREATE TABLE made_by_migration (id integer)');
          throw new Error('boom');
        },
        async down() {},
      };

      await expect(new MigrationRunner(pool, [partial]).up()).rejects.toThrow(MigrationError);

      const { rows } = await pool.query<{ exists: boolean }>(
        `SELECT to_regclass('made_by_migration') IS NOT NULL AS exists`,
      );
      expect(rows[0]?.exists).toBe(false);
    });

    it('commits the schema change and its record together', async () => {
      const creates: Migration = {
        version: 1,
        name: 'creates-a-table',
        async up(client) {
          await client.query('CREATE TABLE made_by_migration (id integer)');
        },
        async down(client) {
          await client.query('DROP TABLE made_by_migration');
        },
      };

      await new MigrationRunner(pool, [creates]).up();

      const { rows } = await pool.query<{ exists: boolean }>(
        `SELECT to_regclass('made_by_migration') IS NOT NULL AS exists`,
      );
      expect(rows[0]?.exists).toBe(true);
    });

    it('serialises concurrent runs so a migration is applied once', async () => {
      // Two API instances booting together would otherwise both read an
      // empty table and both try to apply version 1.
      const log: string[] = [];
      const migrations = [record(1, 'first', log)];

      await Promise.all([
        new MigrationRunner(pool, migrations).up(),
        new MigrationRunner(pool, migrations).up(),
      ]);

      expect(log).toEqual(['up:1']);
    });
  });

  describe('down', () => {
    it('reverts the most recent migration', async () => {
      const log: string[] = [];
      const migrations = [record(1, 'first', log), record(2, 'second', log)];

      await new MigrationRunner(pool, migrations).up();
      const reverted = await new MigrationRunner(pool, migrations).down();

      expect(log).toEqual(['up:1', 'up:2', 'down:2']);
      expect(reverted?.version).toBe(2);
    });

    it('removes the migration record so it can be re-applied', async () => {
      const log: string[] = [];
      const migrations = [record(1, 'first', log)];

      await new MigrationRunner(pool, migrations).up();
      await new MigrationRunner(pool, migrations).down();
      await new MigrationRunner(pool, migrations).up();

      expect(log).toEqual(['up:1', 'down:1', 'up:1']);
    });

    it('returns undefined when nothing is applied', async () => {
      expect(await new MigrationRunner(pool, []).down()).toBeUndefined();
    });

    it('refuses to roll back when the definition is missing', async () => {
      await new MigrationRunner(pool, [record(1, 'first', [])]).up();

      // Simulates the migration file being deleted after it was applied.
      await expect(new MigrationRunner(pool, []).down()).rejects.toThrow(/definition is missing/);
    });

    it('keeps the record when rollback fails', async () => {
      const failing: Migration = {
        version: 1,
        name: 'irreversible',
        async up() {},
        async down() {
          throw new Error('cannot reverse');
        },
      };

      await new MigrationRunner(pool, [failing]).up();
      await expect(new MigrationRunner(pool, [failing]).down()).rejects.toThrow(MigrationError);

      const { rows } = await pool.query<{ count: string }>(
        `SELECT count(*) AS count FROM ${MIGRATIONS_TABLE}`,
      );
      expect(Number(rows[0]?.count)).toBe(1);
    });
  });

  describe('status', () => {
    it('separates applied from pending', async () => {
      const log: string[] = [];
      const migrations = [record(1, 'first', log), record(2, 'second', log)];

      await new MigrationRunner(pool, [migrations[0]!]).up();
      const status = await new MigrationRunner(pool, migrations).status();

      expect(status.applied.map((r) => r.version)).toEqual([1]);
      expect(status.pending.map((m) => m.version)).toEqual([2]);
    });
  });
});

/**
 * Validation happens in the constructor, before any query, so these need no
 * database and must run everywhere — a malformed migration set should fail a
 * developer's suite whether or not they have Postgres running.
 */
describe('MigrationRunner validation', () => {
  const stub = (version: number, name: string): Migration => ({
    version,
    name,
    async up() {},
    async down() {},
  });

  // Never connected to: the constructor throws before any query.
  const pool = {} as Pool;

  it('rejects duplicate versions before running anything', () => {
    expect(() => new MigrationRunner(pool, [stub(1, 'a'), stub(1, 'b')])).toThrow(
      /Duplicate migration version 1/,
    );
  });

  it('rejects a non-positive version', () => {
    expect(() => new MigrationRunner(pool, [stub(0, 'zero')])).toThrow(
      /expected a positive integer/,
    );
  });

  it('rejects a fractional version', () => {
    expect(() => new MigrationRunner(pool, [stub(1.5, 'half')])).toThrow(
      /expected a positive integer/,
    );
  });
});
