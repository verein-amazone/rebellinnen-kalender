import { defineConfig, devices } from '@playwright/test';

/**
 * The website at kalender.amazone.or.at (`site/`, built by `scripts/build-site.mjs`). Kept apart
 * from `playwright.config.ts` because it tests a different artefact: static pages, not the app.
 *
 * Two copies are served. The real build (`dist/site`) has no public store listing yet, so it shows
 * „Bald verfügbar“; a second build with test store addresses (`dist/site-stores`) covers the store
 * buttons and the `/download` redirect. Run with `pnpm test:site`, which builds both first.
 */
export const SITE = 'http://localhost:4320';
export const SITE_WITH_STORES = 'http://localhost:4321';

export default defineConfig({
  testDir: './site/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'] as const, ['list'] as const] : 'list',
  use: {
    baseURL: SITE,
    locale: 'de-AT',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm exec serve dist/site -l 4320 --no-port-switching',
      url: SITE,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'pnpm exec serve dist/site-stores -l 4321 --no-port-switching',
      url: SITE_WITH_STORES,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
