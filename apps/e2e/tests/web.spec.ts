import { expect, test } from '@playwright/test';
import { PORTS } from '../playwright.config';

const WEB = `http://localhost:${PORTS.web}`;

test.describe('Reader', () => {
  test('serves the home page', async ({ page }) => {
    await page.goto(WEB);

    await expect(page.getByRole('heading', { name: 'Scrinode' })).toBeVisible();
  });

  test('applies a theme on first load', async ({ page }) => {
    await page.goto(WEB);

    // next-themes resolves the system preference and sets data-theme.
    await expect(page.locator('html')).toHaveAttribute('data-theme', /light|dark/);
  });

  test('switches theme and keeps it across navigation', async ({ page }) => {
    await page.goto(WEB);

    const toggle = page.getByRole('button', { name: /switch to (light|dark) theme/i });
    const before = await page.locator('html').getAttribute('data-theme');

    await toggle.click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', before ?? '');

    const after = await page.locator('html').getAttribute('data-theme');

    await page.goto(`${WEB}/signin`);
    await expect(page.locator('html')).toHaveAttribute('data-theme', after ?? '');
  });

  test('applies design tokens rather than browser defaults', async ({ page }) => {
    await page.goto(WEB);

    const background = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor,
    );

    // Tailwind 4 tree-shakes unused @theme tokens; `static` prevents that.
    // A default white body would mean the palette was dropped again.
    expect(background).not.toBe('rgba(0, 0, 0, 0)');
    expect(background).not.toBe('');
  });

  test('serves the sign-in page with both providers', async ({ page }) => {
    await page.goto(`${WEB}/signin`);

    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
    await expect(page.getByLabel(/email address/i)).toBeVisible();
  });

  test('labels the email field for assistive technology', async ({ page }) => {
    await page.goto(`${WEB}/signin`);

    // Accessibility is a product requirement, not a polish step.
    await expect(page.getByLabel(/email address/i)).toHaveAttribute('type', 'email');
  });

  test('returns an empty session when signed out', async ({ request }) => {
    const response = await request.get(`${WEB}/api/auth/session`);

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({});
  });

  test('issues a CSRF token', async ({ request }) => {
    const body = await (await request.get(`${WEB}/api/auth/csrf`)).json();

    expect(body.csrfToken).toBeTruthy();
  });
});
