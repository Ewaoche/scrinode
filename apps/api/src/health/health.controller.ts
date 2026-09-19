import { Controller, Get } from '@nestjs/common';
import { HealthService, type HealthReport } from './health.service';

/**
 * Liveness and readiness endpoints.
 *
 * `/health` answers "is this process up" and must stay dependency-free so a
 * platform health check never fails because a downstream is slow.
 *
 * `/health/ready` answers "can this process serve traffic" and does check
 * dependencies. The database check arrives with the data layer in step 5.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  live(): HealthReport {
    return this.health.liveness();
  }

  @Get('ready')
  ready(): HealthReport {
    return this.health.readiness();
  }
}
