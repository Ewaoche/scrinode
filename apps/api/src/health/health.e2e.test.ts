import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HealthModule } from './health.module';

/**
 * HTTP-level tests against a booted application.
 *
 * These exist because controller unit tests cannot catch failures in the
 * request pipeline: a global pipe with a missing peer dependency boots
 * cleanly and only throws on the first request. Exercise the real HTTP path.
 */
describe('Health endpoints (HTTP)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [HealthModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns 200 with status ok', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('GET /health performs no dependency checks', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.body.checks).toBeUndefined();
  });

  it('GET /health/ready returns 200 with a checks map', async () => {
    const response = await request(app.getHttpServer()).get('/health/ready').expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.checks).toBeDefined();
  });

  it('returns 404 for an unknown route', async () => {
    await request(app.getHttpServer()).get('/does-not-exist').expect(404);
  });
});
