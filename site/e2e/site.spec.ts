import { expect, test, type Page } from '@playwright/test';

import { expectNoBlockingViolations } from '../../e2e/support/a11y';
import { SITE, SITE_WITH_STORES } from '../../playwright.site.config';

const APP_STORE = 'https://apps.apple.com/at/app/rebell-innen/id0000000000';
const PLAY_STORE =
  'https://play.google.com/store/apps/details?id=at.or.amazone.rebellinnenkalender';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';

const PAGES = ['/', '/download/', '/datenschutz/', '/nutzungsbedingungen/', '/impressum/'];

/** Records every request that leaves the site's own origin. */
function watchForeignRequests(page: Page, origin: string): string[] {
  const foreign: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== origin) {
      foreign.push(request.url());
    }
  });
  return foreign;
}

test.describe('website', () => {
  for (const path of PAGES) {
    test(`${path} loads nothing from elsewhere and passes axe`, async ({ page }) => {
      const foreign = watchForeignRequests(page, SITE);

      await page.goto(path, { waitUntil: 'networkidle' });

      await expect(page.locator('h1')).toBeVisible();
      expect(foreign).toEqual([]);
      await expectNoBlockingViolations(page);
    });

    test(`${path} does not scroll sideways at 320 px`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto(path);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test('says the app is coming while no store listing is public', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByText('Bald verfügbar im App Store und bei Google Play').first(),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /im App Store laden|bei Google Play laden/ }),
    ).toHaveCount(0);
  });

  test('links both stores once they are public', async ({ page }) => {
    await page.goto(`${SITE_WITH_STORES}/`);

    await expect(
      page.getByRole('link', { name: 'Rebell*innen im App Store laden' }).first(),
    ).toHaveAttribute('href', APP_STORE);
    await expect(
      page.getByRole('link', { name: 'Rebell*innen bei Google Play laden' }).first(),
    ).toHaveAttribute('href', PLAY_STORE);
    await expect(page.getByText('Bald verfügbar')).toHaveCount(0);
  });

  test('links the three legal texts from every page', async ({ page }) => {
    for (const path of PAGES) {
      await page.goto(path);
      const footer = page.getByRole('navigation', { name: 'Rechtliches und Kontakt' });
      for (const name of ['Datenschutz', 'Nutzungsbedingungen', 'Impressum']) {
        await expect(footer.getByRole('link', { name })).toBeVisible();
      }
    }
  });

  test('renders the legal texts from the app’s Markdown', async ({ page }) => {
    await page.goto('/impressum/');

    await expect(page.getByRole('heading', { name: 'Herausgeberin', level: 2 })).toBeVisible();
    await expect(page.getByText('ZVR-Zahl: 070887169')).toBeVisible();
  });

  test('answers a missing page with the 404 page', async ({ page }) => {
    const response = await page.goto('/gibt-es-nicht');

    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Diese Seite gibt es nicht' })).toBeVisible();
  });
});

test.describe('/download', () => {
  test.describe('on an iPhone', () => {
    test.use({ userAgent: IPHONE });

    test('goes straight to the App Store', async ({ page }) => {
      await page.route('https://apps.apple.com/**', (route) =>
        route.fulfill({ contentType: 'text/html', body: '<title>App Store</title>' }),
      );

      await page.goto(`${SITE_WITH_STORES}/download/`);

      await expect(page).toHaveURL(APP_STORE);
    });

    test('stays on the page while the App Store listing is not public', async ({ page }) => {
      await page.goto('/download/');

      await expect(page).toHaveURL(`${SITE}/download/`);
      await expect(page.getByText('Bald verfügbar im App Store und bei Google Play')).toBeVisible();
    });
  });

  test.describe('on Android', () => {
    test.use({ userAgent: ANDROID });

    test('goes straight to Google Play', async ({ page }) => {
      await page.route('https://play.google.com/**', (route) =>
        route.fulfill({ contentType: 'text/html', body: '<title>Google Play</title>' }),
      );

      await page.goto(`${SITE_WITH_STORES}/download/`);

      await expect(page).toHaveURL(PLAY_STORE);
    });
  });

  test('offers both stores on a computer', async ({ page }) => {
    await page.goto(`${SITE_WITH_STORES}/download/`);

    await expect(page).toHaveURL(`${SITE_WITH_STORES}/download/`);
    await expect(page.getByRole('link', { name: /im App Store laden/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /bei Google Play laden/ })).toBeVisible();
  });
});
