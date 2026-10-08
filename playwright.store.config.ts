import { defineConfig } from '@playwright/test';

/**
 * Renders the store screenshots and the Play feature graphic - not a test suite. See
 * docs/store-listing.md; run it with `pnpm store:screenshots`.
 *
 * Kept apart from `playwright.config.ts` on purpose: a different `testDir`, so `pnpm e2e` never
 * picks these files up, and a different port, so a running `ng serve` on 4200 is never reused.
 * It renders the production build, the same one the stores ship, rather than the dev server.
 *
 * One project per store, each sized to what its store asks for. The viewport is the phone in CSS
 * pixels and `deviceScaleFactor` its pixel density, so the PNG comes out at the store's size:
 *
 * - `app-store` - 440×956 @3 = 1320×2868, the 6.9" iPhone size App Store Connect requires (and
 *   scales down for every smaller iPhone).
 * - `play` - 432×864 @2.5 = 1080×2160, a 1:2 phone screenshot, within Play's 2:1 limit.
 */
const PORT = 4300;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './scripts/store-screenshots',
  // One page at a time: the specs write into the same folders, and the order of the files there is
  // the order in the store.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    locale: 'de-AT',
    timezoneId: 'Europe/Vienna',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    isMobile: true,
    hasTouch: true,
    // A returning user with a name, so Heute greets someone and the introduction stays away.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: BASE_URL,
          localStorage: [
            { name: 'rk.intro', value: '{"seenAt":"2026-01-01T00:00:00.000Z"}' },
            { name: 'rk.profile', value: '{"name":"Lena","emoji":"🌻"}' },
          ],
        },
      ],
    },
  },
  projects: [
    {
      name: 'app-store',
      use: { viewport: { width: 440, height: 956 }, deviceScaleFactor: 3 },
    },
    {
      name: 'play',
      use: { viewport: { width: 432, height: 864 }, deviceScaleFactor: 2.5 },
    },
  ],
  webServer: {
    command: `pnpm exec serve -s dist/rebellinnen-kalender/browser -l ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
