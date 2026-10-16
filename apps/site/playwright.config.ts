import { defineConfig, devices } from '@playwright/test';

/**
 * The website's end-to-end tests: static pages, so the built output is served as is.
 *
 * Two copies are served. The real build (`dist`) has no public store listing yet, so it shows
 * „Bald verfügbar“; a second build with test store addresses (`dist-stores`, from
 * e2e/site.config.stores.json) covers the store buttons and the `/download` redirect. Run with
 * `pnpm test:site`, which builds both first.
 */
export const SITE = 'http://localhost:4320';
export const SITE_WITH_STORES = 'http://localhost:4321';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: process.env['CI'] ? [['github'] as const, ['list'] as const] : 'list',
  use: {
    baseURL: SITE,
    locale: 'de-AT',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm exec serve dist -l 4320 --no-port-switching',
      url: SITE,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'pnpm exec serve dist-stores -l 4321 --no-port-switching',
      url: SITE_WITH_STORES,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
