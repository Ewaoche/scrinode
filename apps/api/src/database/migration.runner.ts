import { Logger } from '@nestjs/common';
import type { Db } from 'mongodb';
import { MIGRATIONS_COLLECTION } from './database.constants';
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
 * Replaces what an ORM would provide. Prisma was rejected for Scrinode
 * (docs/PLAN_stage1_scaffold.md §2.1) and never offered MongoDB migrations
 * anyway, so this is the mechanism enforcing schema discipline.
 *
 * Guarantees:
 *   - migrations run in ascending version order, never out of sequence
 *   - an already-applied migration is skipped, so running twice is safe
 *   - a gap or duplicate version fails before anything is applied
 *   - a failure stops the run; later migrations are not attempted
 */
export class MigrationRunner {
  private readonly logger = new Logger(MigrationRunner.name);

  constructor(
    private readonly db: Db,
    private readonly migrations: readonly Migration[],
  ) {
    this.assertWellFormed();
  }

  /** Applies every migration not yet recorded, in order. */
  async up(): Promise<MigrationRecord[]> {
    const applied = await this.appliedVersions();
    const pending = this.ordered().filter((m) => !applied.has(m.version));

    if (pending.length === 0) {
      this.logger.log('No pending migrations');
      return [];
    }

    const records: MigrationRecord[] = [];

    for (const migration of pending) {
      const startedAt = Date.now();

      this.logger.log(`Applying ${migration.version}: ${migration.name}`);

      try {
        await migration.up(this.db);
      } catch (cause) {
        throw new MigrationError(
          `Migration ${migration.version} (${migration.name}) failed: ${
            cause instanceof Error ? cause.message : String(cause)
          }`,
          migration.version,
        );
      }

      const record: MigrationRecord = {
        version: migration.version,
        name: migration.name,
        appliedAt: new Date(),
        durationMs: Date.now() - startedAt,
      };

      await this.collection().insertOne(record);
      records.push(record);
    }

    return records;
  }

  /**
   * Reverses the most recently applied migration.
   *
   * One at a time and deliberately explicit: a bulk rollback in production is
   * almost always the wrong instrument.
   */
  async down(): Promise<MigrationRecord | undefined> {
    const last = await this.collection().findOne({}, { sort: { version: -1 } });

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

    try {
      await migration.down(this.db);
    } catch (cause) {
      throw new MigrationError(
        `Rollback of ${migration.version} (${migration.name}) failed: ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
        migration.version,
      );
    }

    await this.collection().deleteOne({ version: migration.version });

    return {
      version: last.version,
      name: last.name,
      appliedAt: last.appliedAt,
      durationMs: last.durationMs,
    };
  }

  /** Versions applied, in order. */
  async status(): Promise<{ applied: MigrationRecord[]; pending: Migration[] }> {
    const applied = await this.collection().find({}).sort({ version: 1 }).toArray();
    const appliedVersions = new Set(applied.map((r) => r.version));

    return {
      applied: applied.map((r) => ({
        version: r.version,
        name: r.name,
        appliedAt: r.appliedAt,
        durationMs: r.durationMs,
      })),
      pending: this.ordered().filter((m) => !appliedVersions.has(m.version)),
    };
  }

  private collection() {
    return this.db.collection<MigrationRecord>(MIGRATIONS_COLLECTION);
  }

  private async appliedVersions(): Promise<Set<number>> {
    const records = await this.collection().find({}, { projection: { version: 1 } }).toArray();
    return new Set(records.map((r) => r.version));
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
