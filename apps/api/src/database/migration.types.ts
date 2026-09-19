import type { Db } from 'mongodb';

/**
 * A single, ordered schema change.
 *
 * Scrinode is production-first: migrations follow expand → migrate →
 * contract. Add fields and collections first, backfill, switch readers, and
 * only drop in a later, separate deploy. Old and new code run simultaneously
 * during a rollout, so a migration must never break the currently deployed
 * version.
 *
 * `down` is required. A migration that cannot be reversed is a migration that
 * cannot be safely deployed.
 */
export interface Migration {
  /** Ordering key, unique and monotonic: 1, 2, 3… */
  readonly version: number;

  /** Short description of the change, recorded in the migrations collection. */
  readonly name: string;

  up(db: Db): Promise<void>;

  down(db: Db): Promise<void>;
}

/** A record of one applied migration. */
export interface MigrationRecord {
  readonly version: number;
  readonly name: string;
  readonly appliedAt: Date;
  readonly durationMs: number;
}
