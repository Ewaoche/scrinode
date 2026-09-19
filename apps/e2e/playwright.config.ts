import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests across all three Scrinode applications.
 *
 * These are smoke tests proving each app boots, serves, and holds its
 * boundaries. Feature flows arrive with the features.
 *
 * Every app runs against the in-memory MongoDB started by run.mjs, so the
 * suite never reaches Atlas.
 */
const API_PORT = 4100;
const WEB_PORT = 3100;
const BACKOFFICE_PORT = 3101;

export const PORTS = { api: API_PORT, web: WEB_PORT, backoffice: BACKOFFICE_PORT };

/** 32 characters. Test-only: never used outside this suite. */
const E2E_SECRET = 'e2e-test-secret-not-for-real-use-0000';

/**
 * Set by run.mjs, which starts an in-memory MongoDB before invoking
 * Playwright. Running `playwright test` directly will fail to connect, which
 * is deliberate: the suite must never fall back to a real cluster.
 */
const sharedEnv = {
  NODE_ENV: 'production',
  MONGODB_URI: process.env.MONGODB_URI ?? '',
  MONGODB_DB: process.env.MONGODB_DB ?? 'scrinode_e2e',
};

export default defineConfig({
  testDir: './tests',

  // A failing E2E test is a real failure, so retries are limited: retrying
  // until green hides flakiness rather than fixing it.
  retries: process.env.CI ? 1 : 0,
  // Serial in CI so the three servers do not contend; parallel locally,
  // where omitting the key lets Playwright choose.
  ...(process.env.CI ? { workers: 1 } : {}),

  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: [
    {
      command: 'pnpm --filter @scrinode/api start',
      port: API_PORT,
      cwd: '../..',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...sharedEnv,
        API_PORT: String(API_PORT),
        CORS_ORIGINS: `http://localhost:${WEB_PORT},http://localhost:${BACKOFFICE_PORT}`,
      },
    },
    {
      command: 'pnpm --filter @scrinode/web start',
      port: WEB_PORT,
      cwd: '../..',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...sharedEnv,
        PORT: String(WEB_PORT),
        NEXTAUTH_URL: `http://localhost:${WEB_PORT}`,
        NEXTAUTH_SECRET: E2E_SECRET,
        NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}`,
        GOOGLE_CLIENT_ID: 'e2e-client-id',
        GOOGLE_CLIENT_SECRET: 'e2e-client-secret',
      },
    },
    {
      command: 'pnpm --filter @scrinode/backoffice start',
      port: BACKOFFICE_PORT,
      cwd: '../..',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...sharedEnv,
        PORT: String(BACKOFFICE_PORT),
        NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}`,
      },
    },
  ],
});
