import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, type Db } from 'mongodb';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MigrationError, MigrationRunner } from './migration.runner';
import type { Migration } from './migration.types';
import { MIGRATIONS_COLLECTION } from './database.constants';

/**
 * Runs against a real MongoDB server, in memory. Index creation, unique
 * constraints and ordering guarantees cannot be verified against a mock.
 */
describe('MigrationRunner', () => {
  let mongod: MongoMemoryServer;
  let client: MongoClient;
  let db: Db;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = new MongoClient(mongod.getUri());
    await client.connect();
    db = client.db('migration_test');
  }, 120_000);

  afterAll(async () => {
    await client.close();
    await mongod.stop();
  });

  afterEach(async () => {
    const collections = await db.collections();
    await Promise.all(collections.map((c) => c.drop().catch(() => undefined)));
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
      const applied = await new MigrationRunner(db, [record(1, 'first', log)]).up();

      expect(log).toEqual(['up:1']);
      expect(applied).toHaveLength(1);
      expect(applied[0]?.version).toBe(1);
    });

    it('applies migrations in ascending version order', async () => {
      const log: string[] = [];
      // Deliberately registered out of order.
      const migrations = [record(3, 'third', log), record(1, 'first', log), record(2, 'second', log)];

      await new MigrationRunner(db, migrations).up();

      expect(log).toEqual(['up:1', 'up:2', 'up:3']);
    });

    it('is idempotent — a second run applies nothing', async () => {
      const log: string[] = [];
      const migrations = [record(1, 'first', log)];

      await new MigrationRunner(db, migrations).up();
      const second = await new MigrationRunner(db, migrations).up();

      expect(log).toEqual(['up:1']);
      expect(second).toHaveLength(0);
    });

    it('applies only migrations added since the last run', async () => {
      const log: string[] = [];

      await new MigrationRunner(db, [record(1, 'first', log)]).up();
      await new MigrationRunner(db, [record(1, 'first', log), record(2, 'second', log)]).up();

      expect(log).toEqual(['up:1', 'up:2']);
    });

    it('records each applied migration', async () => {
      await new MigrationRunner(db, [record(1, 'first', [])]).up();

      const stored = await db.collection(MIGRATIONS_COLLECTION).findOne({ version: 1 });

      expect(stored?.name).toBe('first');
      expect(stored?.appliedAt).toBeInstanceOf(Date);
      expect(stored?.durationMs).toBeGreaterThanOrEqual(0);
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

      const runner = new MigrationRunner(db, [
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

      await expect(new MigrationRunner(db, [failing]).up()).rejects.toThrow();

      const count = await db.collection(MIGRATIONS_COLLECTION).countDocuments();
      expect(count).toBe(0);
    });
  });

  describe('down', () => {
    it('reverts the most recent migration', async () => {
      const log: string[] = [];
      const migrations = [record(1, 'first', log), record(2, 'second', log)];

      await new MigrationRunner(db, migrations).up();
      const reverted = await new MigrationRunner(db, migrations).down();

      expect(log).toEqual(['up:1', 'up:2', 'down:2']);
      expect(reverted?.version).toBe(2);
    });

    it('removes the migration record so it can be re-applied', async () => {
      const log: string[] = [];
      const migrations = [record(1, 'first', log)];

      await new MigrationRunner(db, migrations).up();
      await new MigrationRunner(db, migrations).down();
      await new MigrationRunner(db, migrations).up();

      expect(log).toEqual(['up:1', 'down:1', 'up:1']);
    });

    it('returns undefined when nothing is applied', async () => {
      expect(await new MigrationRunner(db, []).down()).toBeUndefined();
    });

    it('refuses to roll back when the definition is missing', async () => {
      await new MigrationRunner(db, [record(1, 'first', [])]).up();

      // Simulates the migration file being deleted after it was applied.
      await expect(new MigrationRunner(db, []).down()).rejects.toThrow(/definition is missing/);
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

      await new MigrationRunner(db, [failing]).up();
      await expect(new MigrationRunner(db, [failing]).down()).rejects.toThrow(MigrationError);

      const count = await db.collection(MIGRATIONS_COLLECTION).countDocuments();
      expect(count).toBe(1);
    });
  });

  describe('status', () => {
    it('separates applied from pending', async () => {
      const log: string[] = [];
      const migrations = [record(1, 'first', log), record(2, 'second', log)];

      await new MigrationRunner(db, [migrations[0]!]).up();
      const status = await new MigrationRunner(db, migrations).status();

      expect(status.applied.map((r) => r.version)).toEqual([1]);
      expect(status.pending.map((m) => m.version)).toEqual([2]);
    });
  });

  describe('validation', () => {
    it('rejects duplicate versions before running anything', () => {
      expect(
        () => new MigrationRunner(db, [record(1, 'a', []), record(1, 'b', [])]),
      ).toThrow(/Duplicate migration version 1/);
    });

    it('rejects a non-positive version', () => {
      expect(() => new MigrationRunner(db, [record(0, 'zero', [])])).toThrow(/expected a positive integer/);
    });

    it('rejects a fractional version', () => {
      expect(() => new MigrationRunner(db, [record(1.5, 'half', [])])).toThrow(
        /expected a positive integer/,
      );
    });
  });
});
