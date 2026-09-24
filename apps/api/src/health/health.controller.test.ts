import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { DatabaseHealthIndicator } from '../database/database.health';

/** Minimal Express response double capturing status and body. */
const mockResponse = () => {
  const captured: { status?: number; body?: unknown } = {};
  const response = {
    status(code: number) {
      captured.status = code;
      return response;
    },
    json(body: unknown) {
      captured.body = body;
      return response;
    },
  };
  return { response, captured };
};

describe('HealthController', () => {
  describe('without a database', () => {
    let controller: HealthController;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [HealthController],
        providers: [HealthService],
      }).compile();

      controller = module.get(HealthController);
    });

    it('reports liveness ok', () => {
      expect(controller.live().status).toBe('ok');
    });

    it('reports uptime', () => {
      expect(controller.live().uptimeSeconds).toBeGreaterThanOrEqual(0);
    });

    it('performs no dependency checks on liveness', () => {
      expect(controller.live().checks).toBeUndefined();
    });

    it('reports readiness ok when no dependency is registered', async () => {
      const { response, captured } = mockResponse();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await controller.ready(response as any);

      expect(captured.status).toBe(200);
      expect((captured.body as { status: string }).status).toBe('ok');
    });
  });

  describe('with a database', () => {
    const buildController = async (healthy: boolean): Promise<HealthController> => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [HealthController],
        providers: [
          HealthService,
          {
            provide: DatabaseHealthIndicator,
            useValue: { isHealthy: vi.fn().mockResolvedValue(healthy) },
          },
        ],
      }).compile();

      return module.get(HealthController);
    };

    it('returns 200 and ok when the database responds', async () => {
      const controller = await buildController(true);
      const { response, captured } = mockResponse();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await controller.ready(response as any);

      expect(captured.status).toBe(200);
      expect(captured.body).toMatchObject({ status: 'ok', checks: { database: 'ok' } });
    });

    it('returns 503 and degraded when the database is unreachable', async () => {
      const controller = await buildController(false);
      const { response, captured } = mockResponse();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await controller.ready(response as any);

      // A load balancer must remove this instance rather than send it traffic.
      expect(captured.status).toBe(503);
      expect(captured.body).toMatchObject({
        status: 'degraded',
        checks: { database: 'failing' },
      });
    });

    it('still reports liveness ok when the database is down', async () => {
      const controller = await buildController(false);

      // Restarting a healthy process because the database is slow makes
      // outages worse.
      expect(controller.live().status).toBe('ok');
    });
  });
});
