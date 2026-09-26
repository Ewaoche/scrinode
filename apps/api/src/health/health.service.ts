import { Injectable, Optional } from '@nestjs/common';
import { DatabaseHealthIndicator } from '../database/database.health';

export interface HealthReport {
  readonly status: 'ok' | 'degraded';
  readonly uptimeSeconds: number;
  readonly checks?: Readonly<Record<string, 'ok' | 'failing'>>;
}

/**
 * How long a successful database check is trusted.
 *
 * The container probes `/health/ready` every 30 s (`infra/api/Dockerfile`).
 * Against a colocated Postgres a query per probe cost nothing; against Neon it
 * is 2,880 queries a day, which keeps the managed compute awake permanently
 * and bills for it whether or not anyone is reading Scripture.
 *
 * Caching the verdict rather than widening the probe interval keeps the
 * property §30 wants — readiness genuinely exercises the database — while
 * removing the cost. The trade is detection latency: an outage starting just
 * after a successful check is reported up to this long late, and the probe's
 * own 3 retries already allow 90 s, so this does not dominate.
 */
const HEALTHY_FOR_MS = 60_000;

@Injectable()
export class HealthService {
  private readonly startedAt = Date.now();

  /**
   * The last check's result, when it may still be reused.
   *
   * Only a *healthy* verdict is cached. A failure is always rechecked, because
   * the expensive mistake is reporting a database down for a minute after it
   * has recovered — that keeps an instance out of rotation when it could be
   * serving — and because a failing query is not the case we are economising
   * on.
   */
  private lastHealthy: { at: number } | undefined;

  /** In flight check, so concurrent probes issue one query rather than several. */
  private inFlight: Promise<boolean> | undefined;

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
   * reach the database should be taken out of rotation rather than restarted.
   * The check is cached while healthy — see HEALTHY_FOR_MS.
   */
  async readiness(): Promise<HealthReport> {
    const checks: Record<string, 'ok' | 'failing'> = {};

    if (this.database) {
      checks.database = (await this.isDatabaseHealthy()) ? 'ok' : 'failing';
    }

    const failing = Object.values(checks).some((state) => state === 'failing');

    return {
      status: failing ? 'degraded' : 'ok',
      uptimeSeconds: this.uptimeSeconds(),
      checks,
    };
  }

  /** Forget any cached verdict. For tests, and for a deliberate recheck. */
  resetHealthCache(): void {
    this.lastHealthy = undefined;
  }

  private async isDatabaseHealthy(): Promise<boolean> {
    if (!this.database) return true;

    if (this.lastHealthy && Date.now() - this.lastHealthy.at < HEALTHY_FOR_MS) {
      return true;
    }

    // Coalesce concurrent probes. Without this, a burst of readiness requests
    // each opens its own query against a database we are trying to leave alone.
    this.inFlight ??= this.database
      .isHealthy()
      .then((healthy) => {
        this.lastHealthy = healthy ? { at: Date.now() } : undefined;
        return healthy;
      })
      .finally(() => {
        this.inFlight = undefined;
      });

    return this.inFlight;
  }

  private uptimeSeconds(): number {
    return Math.floor((Date.now() - this.startedAt) / 1000);
  }
}
