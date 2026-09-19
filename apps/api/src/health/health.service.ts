import { Injectable } from '@nestjs/common';

export interface HealthReport {
  readonly status: 'ok' | 'degraded';
  readonly uptimeSeconds: number;
  readonly checks?: Readonly<Record<string, 'ok' | 'failing'>>;
}

@Injectable()
export class HealthService {
  private readonly startedAt = Date.now();

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
   * Dependency checks are registered here as they arrive — the database in
   * step 5, then any downstream the API cannot serve without.
   */
  readiness(): HealthReport {
    const checks: Record<string, 'ok' | 'failing'> = {};

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
