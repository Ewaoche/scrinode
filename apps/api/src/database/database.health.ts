import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Db } from 'mongodb';
import { MONGO_DB } from './database.constants';

/**
 * Readiness check for MongoDB.
 *
 * Used by `/health/ready` only. Liveness deliberately excludes it: restarting
 * a healthy process because Atlas is briefly slow turns a blip into an outage.
 */
@Injectable()
export class DatabaseHealthIndicator {
  private readonly logger = new Logger(DatabaseHealthIndicator.name);

  constructor(@Inject(MONGO_DB) private readonly db: Db) {}

  async isHealthy(): Promise<boolean> {
    try {
      await this.db.command({ ping: 1 });
      return true;
    } catch (cause) {
      // Log the failure but never the connection string.
      this.logger.warn(
        `Database ping failed: ${cause instanceof Error ? cause.message : 'unknown error'}`,
      );
      return false;
    }
  }
}
