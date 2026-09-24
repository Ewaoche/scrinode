import { Logger } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { MIGRATIONS_TABLE } from './database.constants';
import type { Migration, MigrationRecord } from './migration.types';

export class MigrationError extends Error {
  constructor(
    message: string,
    readonly version?: number,
  ) {
    super(message);
    this.name = 'MigrationError';
  }
}

/**
 * Ordered, idempotent migration runner.
 *
 * Replaces what an ORM would provide. Scrinode uses the `pg` driver directly
 * rather than an ORM, so this is the mechanism enforcing schema discipline.
 *
 * Guarantees:
 *   - migrations run in ascending version order, never out of sequence
 *   - an already-applied migration is skipped, so running twice is safe
 *   - a duplicate or malformed version fails before anything is applied
 *   - a failure stops the run; later migrations are not attempted
 *   - each migration and its bookkeeping row commit together, or neither does
 *   - two runners started at once cannot apply the same migration twice
 *
 * The last two are new since the move from MongoDB. Postgres has
 * transactional DDL, so a migration cannot be half-applied; and an advisory
 * lock serialises concurrent runners, which matters the moment a deploy
 * starts more than one instance.
 */
export class MigrationRunner {
  private readonly logger = new Logger(MigrationRunner.name);

  constructor(
    private readonly pool: Pool,
    private readonly migrations: readonly Migration[],
  ) {
    this.assertWellFormed();
  }

  /**
   * Applies every migration not yet recorded, in order.
   *
   * Held under an advisory lock for the whole run. Without it, two API
   * instances booting together would each read an empty migrations table and
   * both try to apply version 1 — the second failing on an object that
   * already exists, and failing confusingly.
   */
  async up(): Promise<MigrationRecord[]> {
    return this.withLock(async () => {
      await this.ensureMigrationsTable();

      const applied = await this.appliedVersions();
      const pending = this.ordered().filter((m) => !applied.has(m.version));

      if (pending.length === 0) {
        this.logger.log('No pending migrations');
        return [];
      }

      const records: MigrationRecord[] = [];

      for (const migration of pending) {
        records.push(await this.apply(migration));
      }

      return records;
    });
  }

  /**
   * Reverses the most recently applied migration.
   *
   * One at a time and deliberately explicit: a bulk rollback in production is
   * almost always the wrong instrument.
   */
  async down(): Promise<MigrationRecord | undefined> {
    return this.withLock(async () => {
      await this.ensureMigrationsTable();

      const last = await this.mostRecent();

      if (!last) {
        this.logger.log('Nothing to roll back');
        return undefined;
      }

      const migration = this.migrations.find((m) => m.version === last.version);

      if (!migration) {
        throw new MigrationError(
          `Cannot roll back version ${last.version}: its definition is missing. ` +
            'The migration file may have been deleted after it was applied.',
          last.version,
        );
      }

      this.logger.log(`Reverting ${migration.version}: ${migration.name}`);

      await this.run(migration, 'down', async (client) => {
        await migration.down(client);

        await client.query(`DELETE FROM ${MIGRATIONS_TABLE} WHERE version = $1`, [
          migration.version,
        ]);
      });

      return last;
    });
  }

  /** Versions applied, in order, alongside those still pending. */
  async status(): Promise<{ applied: MigrationRecord[]; pending: Migration[] }> {
    await this.ensureMigrationsTable();

    const { rows } = await this.pool.query<{
      version: string;
      name: string;
      applied_at: Date;
      duration_ms: string;
    }>(
      `SELECT version, name, applied_at, duration_ms
         FROM ${MIGRATIONS_TABLE}
        ORDER BY version ASC`,
    );

    const applied = rows.map(toRecord);
    const appliedVersions = new Set(applied.map((r) => r.version));

    return {
      applied,
      pending: this.ordered().filter((m) => !appliedVersions.has(m.version)),
    };
  }

  /**
   * Applies one migration and records it.
   *
   * The bookkeeping INSERT happens inside the same transaction as the
   * migration itself, so the two cannot disagree: there is no window in which
   * the schema changed but the record did not, or the reverse.
   */
  private async apply(migration: Migration): Promise<MigrationRecord> {
    const startedAt = Date.now();

    this.logger.log(
      `Applying ${migration.version}: ${migration.name}${
        migration.concurrent ? ' (outside a transaction)' : ''
      }`,
    );

    await this.run(migration, 'up', async (client) => {
      await migration.up(client);

      await client.query(
        `INSERT INTO ${MIGRATIONS_TABLE} (version, name, applied_at, duration_ms)
         VALUES ($1, $2, now(), $3)`,
        [migration.version, migration.name, Date.now() - startedAt],
      );
    });

    return {
      version: migration.version,
      name: migration.name,
      appliedAt: new Date(),
      durationMs: Date.now() - startedAt,
    };
  }

  /**
   * Runs one migration's work, wrapping it in a transaction unless the
   * migration opted out.
   *
   * A `concurrent` migration gets no transaction because Postgres forbids
   * `CREATE INDEX CONCURRENTLY` inside one. Its bookkeeping write is then a
   * separate statement, which is the trade the flag makes explicit.
   */
  private async run(
    migration: Migration,
    direction: 'up' | 'down',
    work: (client: PoolClient) => Promise<void>,
  ): Promise<void> {
    const client = await this.pool.connect();
    const transactional = migration.concurrent !== true;

    try {
      if (transactional) await client.query('BEGIN');

      await work(client);

      if (transactional) await client.query('COMMIT');
    } catch (cause) {
      if (transactional) {
        // Rollback can itself fail if the connection died. The original
        // error is the one worth reporting, so this must not mask it.
        await client.query('ROLLBACK').catch(() => undefined);
      }

      const verb = direction === 'up' ? 'failed' : 'rollback failed';

      throw new MigrationError(
        `Migration ${migration.version} (${migration.name}) ${verb}: ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
        migration.version,
      );
    } finally {
      client.release();
    }
  }

  /**
   * Serialises runs across processes with a session-level advisory lock.
   *
   * The key is arbitrary but must be stable and unique to this purpose; it is
   * a fixed constant rather than a hash so it can be searched for when a lock
   * shows up in `pg_locks`.
   */
  private async withLock<T>(work: () => Promise<T>): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);

      try {
        return await work();
      } finally {
        await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
      }
    } finally {
      client.release();
    }
  }

  /**
   * Creates the bookkeeping table if absent.
   *
   * This table is not itself a migration: the runner needs it before it can
   * read which migrations have run.
   */
  private async ensureMigrationsTable(): Promise<void> {
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
         version     integer     PRIMARY KEY,
         name        text        NOT NULL,
         applied_at  timestamptz NOT NULL DEFAULT now(),
         duration_ms bigint      NOT NULL
       )`,
    );
  }

  private async appliedVersions(): Promise<Set<number>> {
    const { rows } = await this.pool.query<{ version: string }>(
      `SELECT version FROM ${MIGRATIONS_TABLE}`,
    );

    return new Set(rows.map((r) => Number(r.version)));
  }

  private async mostRecent(): Promise<MigrationRecord | undefined> {
    const { rows } = await this.pool.query<{
      version: string;
      name: string;
      applied_at: Date;
      duration_ms: string;
    }>(
      `SELECT version, name, applied_at, duration_ms
         FROM ${MIGRATIONS_TABLE}
        ORDER BY version DESC
        LIMIT 1`,
    );

    const row = rows[0];
    return row ? toRecord(row) : undefined;
  }

  private ordered(): Migration[] {
    return [...this.migrations].sort((a, b) => a.version - b.version);
  }

  /**
   * Rejects malformed migration sets before anything runs.
   *
   * A duplicate version means two changes claim the same slot and ordering is
   * ambiguous. A non-positive or fractional version breaks ordering.
   */
  private assertWellFormed(): void {
    const seen = new Set<number>();

    for (const migration of this.migrations) {
      if (!Number.isInteger(migration.version) || migration.version < 1) {
        throw new MigrationError(
          `Invalid version ${migration.version} (${migration.name}): expected a positive integer`,
        );
      }

      if (seen.has(migration.version)) {
        throw new MigrationError(`Duplicate migration version ${migration.version}`);
      }

      seen.add(migration.version);
    }
  }
}

/** Advisory lock key serialising migration runs. Arbitrary but fixed. */
const MIGRATION_LOCK_KEY = 4_815_162_342;

/**
 * Maps a database row to a record.
 *
 * `bigint` and `integer` both arrive as strings from `pg`, which refuses to
 * narrow them to JavaScript numbers on its own: a bigint can exceed
 * `Number.MAX_SAFE_INTEGER`. Neither column can here, so the conversion is
 * safe — but it has to be deliberate.
 */
function toRecord(row: {
  version: string | number;
  name: string;
  applied_at: Date;
  duration_ms: string | number;
}): MigrationRecord {
  return {
    version: Number(row.version),
    name: row.name,
    appliedAt: row.applied_at,
    durationMs: Number(row.duration_ms),
  };
}
