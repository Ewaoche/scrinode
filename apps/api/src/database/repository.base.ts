import type { Pool, PoolClient, QueryResultRow } from 'pg';

/**
 * Base for table repositories.
 *
 * AGENTS.md §8: domain services must not import the database driver
 * directly. Repositories are the only place driver types appear, which keeps
 * the data layer replaceable and the domain expressed in domain terms.
 *
 * Subclasses expose domain-shaped methods (`findByReference`, not `query`).
 * The protected helpers here exist to serve those methods, not to be called
 * from outside.
 *
 * **Every helper takes parameterised SQL.** Values reach the database as
 * `$1`, `$2`… and never through string interpolation. A repository that
 * builds SQL by concatenating a caller's value is an injection hole, and no
 * amount of validation upstream makes it safe (§33).
 */
export abstract class BaseRepository {
  protected constructor(
    protected readonly pool: Pool,
    protected readonly table: string,
  ) {}

  /** One row, or null. */
  protected async queryOne<T extends QueryResultRow>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<T | null> {
    const { rows } = await this.pool.query<T>(sql, [...params]);
    return rows[0] ?? null;
  }

  /** Every matching row. */
  protected async queryMany<T extends QueryResultRow>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<T[]> {
    const { rows } = await this.pool.query<T>(sql, [...params]);
    return rows;
  }

  /** A statement whose result is only its row count. */
  protected async execute(sql: string, params: readonly unknown[] = []): Promise<number> {
    const { rowCount } = await this.pool.query(sql, [...params]);
    return rowCount ?? 0;
  }

  /**
   * Runs several statements in one transaction.
   *
   * The callback receives a dedicated client; every statement in it must use
   * that client rather than the pool, or it runs outside the transaction and
   * commits independently — which looks like it worked and silently is not
   * atomic.
   */
  protected async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (cause) {
      // Rollback can itself fail if the connection died. The original error
      // is the one worth reporting, so this must not mask it.
      await client.query('ROLLBACK').catch(() => undefined);
      throw cause;
    } finally {
      // Always returns the connection to the pool, including after a failed
      // rollback. A leaked connection is permanent: the pool never reclaims
      // it, and enough leaks exhaust it.
      client.release();
    }
  }
}
