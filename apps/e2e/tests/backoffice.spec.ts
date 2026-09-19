import { expect, test } from '@playwright/test';
import { PORTS } from '../playwright.config';

const BACKOFFICE = `http://localhost:${PORTS.backoffice}`;
const WEB = `http://localhost:${PORTS.web}`;

test.describe('Backoffice', () => {
  test('serves the shell', async ({ page }) => {
    await page.goto(BACKOFFICE);

    await expect(page.getByRole('heading', { name: 'Backoffice' })).toBeVisible();
  });

  test('shows no sections without a session', async ({ page }) => {
    await page.goto(BACKOFFICE);

    // Closed default: an unauthenticated admin sees nothing.
    await expect(page.getByText('No sections available.')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Backoffice' }).getByRole('link')).toHaveCount(0);
  });

  test('sets security headers', async ({ request }) => {
    const headers = (await request.get(BACKOFFICE)).headers();

    // Internal tooling must never be indexed or embedded.
    expect(headers['x-robots-tag']).toContain('noindex');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('no-referrer');
  });

  test('serves no reader authentication routes', async ({ request }) => {
    // Reader auth belongs to @scrinode/web alone. Admin identity is a
    // separate system on a separate domain (AGENTS.md §27.2).
    const response = await request.get(`${BACKOFFICE}/api/auth/session`);

    expect(response.status()).toBe(404);
  });
});

test.describe('Application isolation', () => {
  test('the reader scopes its cookies to a single host', async ({ page, context }) => {
    await page.goto(`${WEB}/api/auth/csrf`);

    const authCookies = (await context.cookies(WEB)).filter((c) => c.name.includes('next-auth'));
    expect(authCookies.length).toBeGreaterThan(0);

    // Reader and backoffice are deployed as scrinode.com and
    // admin.scrinode.com. A cookie set with a leading-dot domain would be
    // sent to every subdomain, handing the backoffice a reader session and
    // breaking the identity separation in AGENTS.md §27.3.
    //
    // Under test both apps share `localhost`, so host isolation cannot be
    // observed here. What can be asserted is that no cookie widens its own
    // scope — the property that must hold in production.
    for (const cookie of authCookies) {
      expect(cookie.domain, `${cookie.name} must not be scoped to a parent domain`).not.toMatch(
        /^\./,
      );
      expect(cookie.httpOnly, `${cookie.name} must not be readable by scripts`).toBe(true);
      expect(cookie.sameSite, `${cookie.name} must restrict cross-site sending`).not.toBe('None');
    }
  });

  test('the reader exposes no backoffice routes', async ({ request }) => {
    expect((await request.get(`${WEB}/sources`)).status()).toBe(404);
    expect((await request.get(`${WEB}/audit`)).status()).toBe(404);
  });
});
