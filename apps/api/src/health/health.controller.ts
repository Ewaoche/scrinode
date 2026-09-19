import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { HealthService, type HealthReport } from './health.service';

/**
 * Liveness and readiness endpoints.
 *
 * `/health` answers "is this process up" and stays dependency-free, so a
 * platform probe never restarts a healthy process because a downstream is
 * slow.
 *
 * `/health/ready` answers "can this process serve traffic" and does check
 * dependencies. It returns 503 when degraded so a load balancer removes the
 * instance from rotation rather than sending it requests it cannot serve.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  live(): HealthReport {
    return this.health.liveness();
  }

  @Get('ready')
  async ready(@Res() response: Response): Promise<void> {
    const report = await this.health.readiness();

    response
      .status(report.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
      .json(report);
  }
}
