import { readFileSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

import { expectNoBlockingViolations } from './support/a11y';
import { SITE, SITE_WITH_STORES } from '../playwright.config';

const APP_STORE = 'https://apps.apple.com/at/app/rebell-innen/id0000000000';
const PLAY_STORE =
  'https://play.google.com/store/apps/details?id=at.or.amazone.rebellinnenkalender';

/**
 * The real configuration (site.config.json), which the `dist` build on SITE uses. Each store's
 * address is filled in when its listing goes public, so the tests on SITE follow it instead of
 * assuming one release state; the `dist-stores` build on SITE_WITH_STORES always has both.
 */
const LIVE: { appStoreUrl: string | null; playStoreUrl: string | null } = JSON.parse(
  readFileSync(new URL('../site.config.json', import.meta.url), 'utf8'),
);

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';

const PAGES = ['/', '/download/', '/datenschutz/', '/nutzungsbedingungen/', '/impressum/'];

/**
 * Records every Content-Security-Policy violation. The policy allows this origin only, so an inlined
 * style, script or `data:` asset the build slipped in shows up here, not just as a console warning.
 */
async function watchPolicyViolations(page: Page): Promise<string[]> {
  const violations: string[] = [];
  await page.exposeFunction('reportPolicyViolation', (violation: string) =>
    violations.push(violation),
  );
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      (window as unknown as { reportPolicyViolation(v: string): void }).reportPolicyViolation(
        `${event.violatedDirective}: ${event.blockedURI}`,
      );
    });
  });
  return violations;
}

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
      const violations = await watchPolicyViolations(page);

      await page.goto(path, { waitUntil: 'networkidle' });

      await expect(page.locator('h1')).toBeVisible();
      expect(foreign).toEqual([]);
      expect(violations).toEqual([]);
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

  // Verein Amazone asked for the website to make no claim about advertising, although the store
  // description does (see src/pages/index.astro). The privacy policy is the exception: saying what
  // the app does not do is its job.
  for (const path of ['/', '/download/']) {
    test(`${path} makes no claim about advertising`, async ({ page }) => {
      await page.goto(path);

      await expect(page.locator('body')).not.toContainText('Werbung');
    });
  }

  test('links each public store and says „Bald verfügbar“ for the others', async ({ page }) => {
    await page.goto('/');

    const stores = [
      { url: LIVE.appStoreUrl, link: 'Rebell*innen im App Store laden', soon: 'im App Store' },
      {
        url: LIVE.playStoreUrl,
        link: 'Rebell*innen bei Google Play laden',
        soon: 'bei Google Play',
      },
    ];
    for (const store of stores) {
      const link = page.getByRole('link', { name: store.link });
      if (store.url) {
        await expect(link.first()).toHaveAttribute('href', store.url);
      } else {
        await expect(link).toHaveCount(0);
      }
    }
    const missing = stores.filter((store) => !store.url).map((store) => store.soon);
    const notice = page.getByText(/Bald verfügbar/).first();
    if (missing.length > 0) {
      await expect(notice).toBeVisible();
      await expect(page.locator('main')).toContainText(`Bald verfügbar ${missing.join(' und ')}`);
    } else {
      await expect(notice).toHaveCount(0);
    }
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

  test('settles the app screens into place as they scroll in', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    const screen = page.locator('.settle').first();
    const style = () =>
      screen.evaluate((element) => {
        const { animationName, animationTimeline, transform } = getComputedStyle(element);
        return { animationName, animationTimeline, transform };
      });

    // Tilted while it scrolls in, upright once it is in view. A minifier that folds the timeline
    // into the `animation` shorthand silently drops the whole declaration, which this catches.
    expect(await style()).toMatchObject({ animationName: 'settle', animationTimeline: 'view()' });
    expect((await style()).transform).not.toBe('none');
    await screen.scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 400);
    await expect.poll(async () => (await style()).transform).toBe('matrix(1, 0, 0, 1, 0, 0)');
  });

  test('keeps the app screens still for visitors who asked for less motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    await expect(page.locator('.settle').first()).toHaveCSS('animation-name', 'none');
  });

  test('lists the sections of a long legal text and links to each', async ({ page }) => {
    await page.goto('/datenschutz/');
    // On a phone the list is collapsed under „Inhalt“.
    await page.setViewportSize({ width: 390, height: 844 });
    const list = page.getByRole('navigation', { name: 'Inhalt: Datenschutz' });
    await page.getByText('Inhalt', { exact: true }).first().click();

    const links = list.getByRole('link');
    expect(await links.count()).toBeGreaterThanOrEqual(6);
    for (const href of await links.evaluateAll((all) => all.map((a) => a.getAttribute('href')))) {
      await expect(page.locator(`[id="${decodeURIComponent(href!.slice(1))}"]`)).toHaveCount(1);
    }
  });

  test('leaves the short imprint without a section list', async ({ page }) => {
    await page.goto('/impressum/');

    await expect(page.getByRole('navigation', { name: /^Inhalt/ })).toHaveCount(0);
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
      test.skip(LIVE.appStoreUrl !== null, 'the App Store listing is public');
      await page.goto('/download/');

      await expect(page).toHaveURL(`${SITE}/download/`);
      await expect(page.locator('main')).toContainText('Bald verfügbar im App Store');
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
