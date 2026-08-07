import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for the Rebell*innen Kalender end-to-end smoke tests.
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Two workers on CI: the hosted runner has 4 vCPUs; leave headroom for the server and browsers. */
  workers: process.env.CI ? 2 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI ? [['html', { open: 'never' }] as const, ['github'] as const] : 'html',
  /*
   * The first database-gated assertion of a test pays the cold web-SQLite open (wasm fetch,
   * IndexedDB store, migrations). On a shared CI runner that can exceed the default 5 s expect
   * budget; locally the default stays, so a genuine slowdown is still caught early.
   */
  expect: {
    timeout: process.env.CI ? 15_000 : 5_000,
  },
  /* Shared settings for all the projects below. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:4200',
    /* Collect trace when retrying the failed test. */
    trace: 'on-first-retry',
  },

  /* Only Chromium for now; VoiceOver/TalkBack testing happens on real devices later. */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /*
   * Serve the Angular app before running the tests. CI tests the promoted production build served
   * statically (`pnpm build` must have run first); local runs keep the dev-server ergonomics.
   */
  webServer: {
    command: process.env.CI ? 'pnpm serve:dist' : 'pnpm start',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
