import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService],
    }).compile();

    controller = module.get(HealthController);
  });

  describe('GET /health', () => {
    it('reports ok', () => {
      expect(controller.live().status).toBe('ok');
    });

    it('reports uptime', () => {
      expect(controller.live().uptimeSeconds).toBeGreaterThanOrEqual(0);
    });

    it('performs no dependency checks', () => {
      // Liveness must not fail because a downstream is slow.
      expect(controller.live().checks).toBeUndefined();
    });
  });

  describe('GET /health/ready', () => {
    it('reports ok when no check is failing', () => {
      expect(controller.ready().status).toBe('ok');
    });

    it('includes a checks map', () => {
      expect(controller.ready().checks).toBeDefined();
    });
  });
});
