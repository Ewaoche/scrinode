import type { PoolClient } from 'pg';

/**
 * A single, ordered schema change.
 *
 * Scrinode is production-first: migrations follow expand → migrate →
 * contract. Add columns and tables first, backfill, switch readers, and only
 * drop in a later, separate deploy. Old and new code run simultaneously
 * during a rollout, so a migration must never break the currently deployed
 * version.
 *
 * `down` is required. A migration that cannot be reversed is a migration that
 * cannot be safely deployed.
 *
 * Both hooks receive a `PoolClient` already inside a transaction. Postgres
 * has transactional DDL, so a migration that fails partway leaves no trace —
 * a guarantee MongoDB could not offer, and the reason the runner no longer
 * needs to reason about partially-applied state.
 *
 * Two consequences of that transaction are worth knowing before writing one:
 *
 *   - Do not issue BEGIN, COMMIT or ROLLBACK. The runner owns the
 *     transaction; a nested COMMIT would end it early and forfeit the
 *     guarantee.
 *   - `CREATE INDEX CONCURRENTLY` cannot run inside a transaction. A
 *     migration needing it must declare `concurrent: true`, which trades the
 *     all-or-nothing guarantee for the ability to build an index without
 *     locking writes on a live table.
 */
export interface Migration {
  /** Ordering key, unique and monotonic: 1, 2, 3… */
  readonly version: number;

  /** Short description of the change, recorded in the migrations table. */
  readonly name: string;

  /**
   * Run outside a transaction.
   *
   * Required for `CREATE INDEX CONCURRENTLY`, `DROP INDEX CONCURRENTLY` and
   * `ALTER TYPE ... ADD VALUE`, none of which Postgres permits inside one.
   *
   * The cost is real: a failure partway leaves the database in whatever state
   * the last successful statement produced, and `down` may have to cope with
   * a half-built index. Set this only when locking a live table is the
   * greater risk, and make every statement idempotent.
   */
  readonly concurrent?: boolean;

  up(client: PoolClient): Promise<void>;

  down(client: PoolClient): Promise<void>;
}

/** A record of one applied migration. */
export interface MigrationRecord {
  readonly version: number;
  readonly name: string;
  readonly appliedAt: Date;
  readonly durationMs: number;
}
