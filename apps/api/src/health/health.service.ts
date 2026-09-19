import { Injectable, Optional } from '@nestjs/common';
import { DatabaseHealthIndicator } from '../database/database.health';

export interface HealthReport {
  readonly status: 'ok' | 'degraded';
  readonly uptimeSeconds: number;
  readonly checks?: Readonly<Record<string, 'ok' | 'failing'>>;
}

@Injectable()
export class HealthService {
  private readonly startedAt = Date.now();

  constructor(
    // Optional so the health module can be tested without a database.
    @Optional() private readonly database?: DatabaseHealthIndicator,
  ) {}

  /** Process liveness. Deliberately free of dependency checks. */
  liveness(): HealthReport {
    return {
      status: 'ok',
      uptimeSeconds: this.uptimeSeconds(),
    };
  }

  /**
   * Readiness to serve traffic.
   *
   * Unlike liveness, this does check dependencies: a process that cannot
   * reach MongoDB should be taken out of rotation rather than restarted.
   */
  async readiness(): Promise<HealthReport> {
    const checks: Record<string, 'ok' | 'failing'> = {};

    if (this.database) {
      checks.database = (await this.database.isHealthy()) ? 'ok' : 'failing';
    }

    const failing = Object.values(checks).some((state) => state === 'failing');

    return {
      status: failing ? 'degraded' : 'ok',
      uptimeSeconds: this.uptimeSeconds(),
      checks,
    };
  }

  private uptimeSeconds(): number {
    return Math.floor((Date.now() - this.startedAt) / 1000);
  }
}
