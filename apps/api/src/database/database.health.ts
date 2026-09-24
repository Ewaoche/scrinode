import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from './database.constants';

/**
 * Readiness check for PostgreSQL.
 *
 * Used by `/health/ready` only. Liveness deliberately excludes it: restarting
 * a healthy process because the database is briefly slow turns a blip into an
 * outage.
 */
@Injectable()
export class DatabaseHealthIndicator {
  private readonly logger = new Logger(DatabaseHealthIndicator.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async isHealthy(): Promise<boolean> {
    try {
      // `SELECT 1` checks out a connection and round-trips a query, so it
      // exercises the pool rather than only the driver's cached state.
      await this.pool.query('SELECT 1');
      return true;
    } catch (cause) {
      // Log the failure but never the connection string.
      this.logger.warn(
        `Database check failed: ${cause instanceof Error ? cause.message : 'unknown error'}`,
      );
      return false;
    }
  }
}
