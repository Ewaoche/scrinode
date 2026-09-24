import { Pool, type PoolClient } from 'pg';

/**
 * Database access for the ingestion CLI.
 *
 * The CLI opens a connection in several commands, and every one of them
 * wants the same thing: read `DATABASE_URL`, fail with a usable message when
 * it is missing, apply the same pool settings, and close cleanly afterwards.
 * Repeating that produced six slightly different versions under MongoDB, one
 * of which forgot to load `.env` at all.
 */

/**
 * Open a pool, or exit with an explanation.
 *
 * `onMissing` is the CLI's `fail`, passed in so this module does not depend
 * on the CLI's exit behaviour.
 */
export function openPool(purpose: string, onMissing: (message: string) => never): Pool {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    onMissing(
      `${purpose} needs DATABASE_URL in the environment.\n` +
        '  Local:  postgres://scrinode:<password>@localhost:5432/scrinode_dev\n' +
        '  It is read from .env at the repository root.',
    );
  }

  const pool = new Pool({
    connectionString,

    // The CLI is a batch job: a handful of connections is plenty, and a
    // large pool would compete with the API for Postgres backends.
    max: 4,
    connectionTimeoutMillis: 15_000,

    ...(process.env.DATABASE_SSL === 'true' ? { ssl: { rejectUnauthorized: true } } : {}),
  });

  // Without a listener, `pg` turns an idle-client failure into an unhandled
  // 'error' event and kills the process — losing a long ingestion run to a
  // dropped connection the pool would otherwise have replaced.
  pool.on('error', (error: Error) => {
    process.stderr.write(`[db] idle client error: ${error.message}\n`);
  });

  return pool;
}

/**
 * Run work inside a transaction, always releasing the connection.
 *
 * A leaked connection is permanent — the pool never reclaims it — and a
 * batch job that leaks one per batch exhausts the pool partway through a run
 * that has already done most of its work.
 */
export async function inTransaction<T>(
  pool: Pool,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (cause) {
    // Rollback can itself fail if the connection died. The original error is
    // the one worth reporting, so this must not mask it.
    await client.query('ROLLBACK').catch(() => undefined);
    throw cause;
  } finally {
    client.release();
  }
}

/**
 * Build a multi-row `VALUES` list and its parameters.
 *
 * Postgres caps a statement at 65,535 parameters, and inserting rows one at a
 * time across ~200k units is slow enough to matter. A multi-row insert is the
 * replacement for MongoDB's `bulkWrite`.
 *
 * Returns `$1, $2, $3), ($4, ...` style placeholders alongside the flattened
 * parameter array, so the caller writes the column list and conflict clause
 * and never interpolates a value.
 */
export function valuesClause(rows: readonly (readonly unknown[])[]): {
  placeholders: string;
  params: unknown[];
} {
  const params: unknown[] = [];
  const groups: string[] = [];

  for (const row of rows) {
    const slots = row.map((value) => {
      params.push(value);
      return `$${params.length}`;
    });

    groups.push(`(${slots.join(', ')})`);
  }

  return { placeholders: groups.join(', '), params };
}

/**
 * Largest number of rows that fits under Postgres's parameter cap.
 *
 * 65,535 is the hard limit; this leaves room for a statement's own
 * parameters and keeps each batch small enough that a failure does not
 * discard much work.
 */
export function batchSizeFor(columnsPerRow: number): number {
  return Math.max(1, Math.floor(60_000 / columnsPerRow));
}
