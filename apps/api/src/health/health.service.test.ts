import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HealthService } from './health.service';
import type { DatabaseHealthIndicator } from '../database/database.health';

/**
 * The readiness check caches a healthy verdict, so a 30 s container probe does
 * not issue 2,880 queries a day against a metered database. These assert the
 * caching actually happens — the cost saving is the reason it exists — and that
 * it does not cache the case where caching would be harmful.
 */
describe('HealthService', () => {
  let isHealthy: ReturnType<typeof vi.fn>;
  let service: HealthService;

  const indicator = () => ({ isHealthy }) as unknown as DatabaseHealthIndicator;

  beforeEach(() => {
    vi.useFakeTimers();
    isHealthy = vi.fn().mockResolvedValue(true);
    service = new HealthService(indicator());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('liveness', () => {
    it('never touches the database', async () => {
      // A platform probe must not restart a healthy process because a
      // downstream is slow.
      expect(service.liveness().status).toBe('ok');
      expect(isHealthy).not.toHaveBeenCalled();
    });
  });

  describe('readiness', () => {
    it('queries the database on the first call', async () => {
      const report = await service.readiness();

      expect(report.status).toBe('ok');
      expect(report.checks?.database).toBe('ok');
      expect(isHealthy).toHaveBeenCalledTimes(1);
    });

    it('reuses a healthy verdict instead of querying again', async () => {
      // The whole point: the container probes every 30 s, and each query
      // against Neon keeps its compute awake.
      await service.readiness();
      await service.readiness();
      await service.readiness();

      expect(isHealthy).toHaveBeenCalledTimes(1);
    });

    it('rechecks once the cached verdict expires', async () => {
      await service.readiness();

      vi.advanceTimersByTime(60_001);
      await service.readiness();

      expect(isHealthy).toHaveBeenCalledTimes(2);
    });

    it('still reports ok from cache', async () => {
      await service.readiness();
      isHealthy.mockResolvedValue(false);

      // Within the window the stale healthy verdict stands. This is the
      // accepted trade: detection is late by at most the cache window, and the
      // probe's own retries already allow longer than that.
      expect((await service.readiness()).status).toBe('ok');
    });

    it('never caches a failure', async () => {
      // Caching a failure would keep an instance out of rotation after the
      // database recovered, which is worse than an extra query.
      isHealthy.mockResolvedValue(false);

      expect((await service.readiness()).status).toBe('degraded');
      expect((await service.readiness()).status).toBe('degraded');

      expect(isHealthy).toHaveBeenCalledTimes(2);
    });

    it('recovers as soon as the database does', async () => {
      isHealthy.mockResolvedValue(false);
      expect((await service.readiness()).status).toBe('degraded');

      isHealthy.mockResolvedValue(true);
      expect((await service.readiness()).status).toBe('ok');
    });

    it('coalesces concurrent probes into one query', async () => {
      // A burst of readiness requests must not each open a connection to the
      // database we are trying to leave idle.
      let release: (value: boolean) => void = () => {};
      isHealthy.mockReturnValue(new Promise<boolean>((resolve) => (release = resolve)));

      const all = Promise.all([
        service.readiness(),
        service.readiness(),
        service.readiness(),
      ]);

      release(true);
      const reports = await all;

      expect(reports.every((r) => r.status === 'ok')).toBe(true);
      expect(isHealthy).toHaveBeenCalledTimes(1);
    });

    it('reports ok when no database is wired at all', async () => {
      const bare = new HealthService();

      expect((await bare.readiness()).status).toBe('ok');
    });
  });

  describe('resetHealthCache', () => {
    it('forces the next call to query', async () => {
      await service.readiness();
      service.resetHealthCache();
      await service.readiness();

      expect(isHealthy).toHaveBeenCalledTimes(2);
    });
  });
});
