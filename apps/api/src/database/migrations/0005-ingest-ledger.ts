import type { PoolClient } from 'pg';
import type { Migration } from '../migration.types';

/**
 * Reconciles `ingest_runs` with what the ingestion CLI actually writes.
 *
 * Migration 0002 created the table during the MongoDB-to-Postgres port and
 * four columns did not survive the translation. The CLI's ledger writes
 * `status`, `object_count`, `book_count` and `host`; the table had none of
 * them, so `load` failed outright:
 *
 *   column "status" of relation "ingest_runs" does not exist
 *
 * `status` is the consequential one. `isUpToDate()` in the ledger skips a
 * stage only when a previous run **completed** against the same archive hash
 * — a run still marked `running` is treated as interrupted and redone. Without
 * the column there is no such distinction, so the idempotency the ledger
 * exists to provide could not work at all.
 *
 * Written as a new migration rather than an edit to 0002, which has already
 * been applied. A migration's history is a record of what ran (§24).
 *
 * `manifest_sha256` is deliberately left alone. It holds the publisher
 * archive's hash, so the name is poor — the ledger's own type calls it
 * `archiveSha256`, and the `sources` table spells the same value
 * `archive_sha256`. But the CLI's ledger SQL reads and writes
 * `manifest_sha256` on this table, so renaming it here would break the
 * command this migration exists to unblock. The inconsistency is recorded
 * rather than fixed: renaming a column and its every caller is a change of
 * its own, and expand → migrate → contract (§24) is how it should be done.
 */
export const migration0005: Migration = {
  version: 5,
  name: 'ingest-ledger',

  async up(client: PoolClient): Promise<void> {
    // A CHECK rather than application validation: the ledger's decisions turn
    // on this value, and a typo writing 'complete' instead of 'completed'
    // would silently make every run look unfinished (§24).
    await client.query(`
      ALTER TABLE ingest_runs
        ADD COLUMN status text NOT NULL DEFAULT 'running'
          CHECK (status IN ('running', 'completed', 'failed'))
    `);

    // Objects written by `upload`, books by either stage. Nullable because a
    // stage reports only the counts that mean something for it — `load` writes
    // no objects, and a zero there would read as "uploaded nothing".
    await client.query('ALTER TABLE ingest_runs ADD COLUMN object_count integer');
    await client.query('ALTER TABLE ingest_runs ADD COLUMN book_count integer');

    // Which machine ran the stage. The ledger is shared, so a run nobody can
    // attribute is a run nobody can ask about.
    await client.query('ALTER TABLE ingest_runs ADD COLUMN host text');

    // `status` is what every skip decision reads, and it is always read
    // together with the translation and stage the existing index covers.
    await client.query(`
      CREATE INDEX ingest_runs_status_idx
        ON ingest_runs (status, translation, stage)
    `);
  },

  async down(client: PoolClient): Promise<void> {
    await client.query('DROP INDEX IF EXISTS ingest_runs_status_idx');

    await client.query('ALTER TABLE ingest_runs DROP COLUMN IF EXISTS host');
    await client.query('ALTER TABLE ingest_runs DROP COLUMN IF EXISTS book_count');
    await client.query('ALTER TABLE ingest_runs DROP COLUMN IF EXISTS object_count');
    await client.query('ALTER TABLE ingest_runs DROP COLUMN IF EXISTS status');
  },
};
