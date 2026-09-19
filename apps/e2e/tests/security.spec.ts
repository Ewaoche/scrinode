import { expect, test } from '@playwright/test';
import { PORTS } from '../playwright.config';

const API = `http://localhost:${PORTS.api}`;
const WEB = `http://localhost:${PORTS.web}`;
const BACKOFFICE = `http://localhost:${PORTS.backoffice}`;

/**
 * Security regressions are silent: nothing breaks when a header stops being
 * sent, and the gap is only found by someone looking for it. These tests make
 * the hardening in AGENTS.md §33 fail loudly instead.
 */

test.describe('API hardening', () => {
  test('does not advertise its framework', async ({ request }) => {
    const headers = (await request.get(`${API}/health`)).headers();

    expect(headers['x-powered-by']).toBeUndefined();
  });

  test('sets content and framing protections', async ({ request }) => {
    const headers = (await request.get(`${API}/health`)).headers();

    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBeDefined();
    expect(headers['cross-origin-resource-policy']).toBe('same-site');
  });

  test('allows a configured origin', async ({ request }) => {
    const response = await request.get(`${API}/health`, {
      headers: { Origin: `http://localhost:${PORTS.web}` },
    });

    expect(response.headers()['access-control-allow-origin']).toBe(
      `http://localhost:${PORTS.web}`,
    );
  });

  test('refuses an unlisted origin', async ({ request }) => {
    const response = await request.get(`${API}/health`, {
      headers: { Origin: 'https://evil.example.com' },
    });

    // Without this header a browser blocks the response. Its absence is the
    // refusal; the request itself still completes.
    expect(response.headers()['access-control-allow-origin']).toBeUndefined();
  });

  test('never returns a wildcard origin', async ({ request }) => {
    // The API serves credentialed requests, so '*' would be both invalid and
    // a sign the allow-list had been disabled.
    const response = await request.get(`${API}/health`, {
      headers: { Origin: 'https://evil.example.com' },
    });

    expect(response.headers()['access-control-allow-origin']).not.toBe('*');
  });

  test('exempts health checks from rate limiting', async ({ request }) => {
    // A throttled probe reads as an outage and triggers needless restarts.
    const statuses = await Promise.all(
      Array.from({ length: 20 }, () => request.get(`${API}/health`).then((r) => r.status())),
    );

    expect(statuses.every((status) => status === 200)).toBe(true);
  });
});

test.describe('Reader hardening', () => {
  test('sets a content security policy', async ({ request }) => {
    const csp = (await request.get(WEB)).headers()['content-security-policy'];

    expect(csp).toBeDefined();
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  test('does not advertise its framework', async ({ request }) => {
    expect((await request.get(WEB)).headers()['x-powered-by']).toBeUndefined();
  });

  test('sets framing, sniffing and referrer protections', async ({ request }) => {
    const headers = (await request.get(WEB)).headers();

    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    // A full referrer would reveal which passage a reader is studying.
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  test('disables unneeded browser features', async ({ request }) => {
    const policy = (await request.get(WEB)).headers()['permissions-policy'];

    expect(policy).toContain('camera=()');
    expect(policy).toContain('microphone=()');
    expect(policy).toContain('geolocation=()');
  });
});

test.describe('Backoffice hardening', () => {
  test('sets a content security policy', async ({ request }) => {
    const csp = (await request.get(BACKOFFICE)).headers()['content-security-policy'];

    expect(csp).toBeDefined();
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  test('does not advertise its framework', async ({ request }) => {
    expect((await request.get(BACKOFFICE)).headers()['x-powered-by']).toBeUndefined();
  });

  test('refuses to be indexed or embedded', async ({ request }) => {
    const headers = (await request.get(BACKOFFICE)).headers();

    expect(headers['x-robots-tag']).toContain('noindex');
    expect(headers['x-frame-options']).toBe('DENY');
    // Internal tooling must leak no referrer at all.
    expect(headers['referrer-policy']).toBe('no-referrer');
  });
});
