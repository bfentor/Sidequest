import { defineConfig, devices } from '@playwright/test';

/**
 * Runs against a web build and API that are already up (see .github/workflows/ci.yml,
 * or README's "End-to-end tests" for running them locally). The API needs the demo
 * data: `python manage.py seed_demo`.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  // Every test uses the same demo account, so they take turns.
  workers: 1,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    // A locally installed Chromium, if Playwright's own isn't downloaded.
    launchOptions: { executablePath: process.env.E2E_CHROMIUM || undefined },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
});
