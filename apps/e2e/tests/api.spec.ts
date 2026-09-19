import { expect, test } from '@playwright/test';
import { PORTS } from '../playwright.config';

const API = `http://localhost:${PORTS.api}`;

test.describe('API', () => {
  test('reports liveness', async ({ request }) => {
    const response = await request.get(`${API}/health`);

    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'ok' });
  });

  test('liveness performs no dependency checks', async ({ request }) => {
    // A platform probe must not restart a healthy process because a
    // downstream is slow.
    const body = await (await request.get(`${API}/health`)).json();

    expect(body.checks).toBeUndefined();
  });

  test('reports readiness including the database', async ({ request }) => {
    const response = await request.get(`${API}/health/ready`);

    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({
      status: 'ok',
      checks: { database: 'ok' },
    });
  });

  test('returns 404 for an unknown route', async ({ request }) => {
    expect((await request.get(`${API}/nope`)).status()).toBe(404);
  });

  test('exposes no admin routes yet', async ({ request }) => {
    // The admin module arrives in Stage 2 behind a global guard. Until then
    // nothing under /admin should answer.
    const response = await request.get(`${API}/admin/sources`);

    expect(response.status()).toBe(404);
  });
});
