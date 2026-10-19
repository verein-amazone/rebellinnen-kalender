import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

import {
  removeDatabaseWarmUpEntries,
  seedAppCalendar,
  seedOccurrence,
} from '../../e2e/support/calendar-seed';

/**
 * The store screenshots, the Play feature graphic and the App Store header and search results
 * assets, rendered from the production web build (see
 * playwright.store.config.ts and docs/store-listing.md).
 *
 * Everything that would make two runs differ is pinned: the clock (a fixed day, Weltfrauentag,
 * so Heute's impulse is always the same one), the zone and locale, the demo data, and the fonts,
 * which the app bundles. Run it, look at every PNG, and commit them.
 */

/** Playwright runs from the repository root, like `e2e/support/developer-tools.ts` assumes. */
const ROOT = process.cwd();

const APP_STORE_SCREENSHOTS = join(ROOT, 'fastlane', 'screenshots', 'de-DE');

/**
 * Where each store's tool reads its screenshots from, in upload order by file name. Both App Store
 * sets share one folder: deliver sorts a screenshot into its display type by its pixel size, so the
 * prefix only keeps the two sets apart on disk - and lets each project replace its own files only.
 */
const OUTPUT: Record<string, { dir: string; prefix: string }> = {
  'app-store': { dir: APP_STORE_SCREENSHOTS, prefix: 'iphone-' },
  'app-store-duo': { dir: APP_STORE_SCREENSHOTS, prefix: 'duo-' },
  play: {
    dir: join(ROOT, 'fastlane', 'metadata', 'android', 'de-DE', 'images', 'phoneScreenshots'),
    prefix: '',
  },
};

const PLAY_IMAGES = join(ROOT, 'fastlane', 'metadata', 'android', 'de-DE', 'images');

/**
 * The App Store header and search results assets. deliver cannot upload either, so they live outside
 * `fastlane/screenshots/` and `fastlane/metadata/` and are uploaded by hand (docs/store-listing.md).
 */
const APP_STORE_ASSETS = join(ROOT, 'fastlane', 'app-store-assets');

/** Monday, 8 March 2027, 9:30 in Vienna. */
const NOW = new Date('2027-03-08T09:30:00+01:00');
const TODAY = '2027-03-08';

/**
 * The content the screenshots show, as Verein Amazone chose it: a Rebell*in of today whose portrait
 * is in the public domain (Christina Koch) and Wissensimpulse illustrated by Verein Amazone itself,
 * so no screenshot carries third-party licence terms into the store (see
 * `public/content/images.json`).
 */
const REBELLIN_ID = 'reb-02';
const WISSEN_ID = 'wi-06';
const BOOKMARKED_IDS = [REBELLIN_ID, WISSEN_ID, 'wi-18', 'wi-07'];

/**
 * Heute's impulse: „Heute ist Feministischer Kampftag!“, which fits the pinned date. The daily pick
 * is weighted random over the catalog, so it is written into the store instead of left to chance -
 * the stored pick for today is what Heute shows (see `DailyImpulseInteractor`).
 */
const IMPULSE_ID = 'wi-08';

/** Stores read the colour values only; an alpha channel makes Play reject the feature graphic. */
async function writeOpaquePng(png: Buffer, path: string): Promise<void> {
  await sharp(png).removeAlpha().png({ compressionLevel: 9 }).toFile(path);
}

/** Waits until the page has nothing left to load that would change a pixel. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() =>
    Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0),
  );
  await page.waitForLoadState('networkidle');
}

async function addReminder(page: Page, text: string): Promise<void> {
  await page.getByRole('button', { name: 'Punkt hinzufügen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Neue Erinnerung' });
  await dialog.getByLabel('Text der Erinnerung').fill(text);
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: text })).toBeVisible();
}

async function addAppointment(
  page: Page,
  appointment: { title: string; day: string; start: string; end: string; location?: string },
): Promise<void> {
  await page.goto(`/calendar/event/new?day=${appointment.day}`);
  await page.getByLabel('Titel').fill(appointment.title);
  if (appointment.location !== undefined) {
    await page.getByLabel('Ort').fill(appointment.location);
  }
  await page.locator('#event-form-date-time button').first().click();
  await page.getByLabel('Startzeit').fill(appointment.start);
  await page.getByLabel('Endzeit').fill(appointment.end);
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page).toHaveURL(/\/calendar\?day=/);
}

/** The demo data every screenshot shows: a believable day in March. */
async function seedDemoData(page: Page): Promise<void> {
  await seedAppCalendar(page, 'Mein Kalender');
  await seedOccurrence(page, {
    sourceType: 'ics',
    title: 'Weltfrauen*tag',
    day: TODAY,
    calendarName: 'Rebell*innen Termine',
    color: '#7B3FA8',
  });

  await addAppointment(page, {
    title: 'Demo!',
    day: TODAY,
    start: '14:00',
    end: '16:00',
    location: 'Kornmarktplatz',
  });
  await addAppointment(page, {
    title: 'Kaffee mit Mira',
    day: TODAY,
    start: '17:30',
    end: '18:30',
  });
  for (const [title, day, start, end] of [
    ['Chorprobe', '2027-03-03', '19:00', '21:00'],
    ['Zahnarzt', '2027-03-05', '08:30', '09:00'],
    ['Lesekreis', '2027-03-12', '19:00', '20:30'],
    ['Konzert mit Jule', '2027-03-20', '20:00', '22:30'],
    ['Oma besuchen', '2027-03-22', '15:00', '18:00'],
  ]) {
    await addAppointment(page, { title, day, start, end });
  }
  await addAppointment(page, {
    title: 'Workshop Rebell*innen Kalender',
    day: '2027-03-10',
    start: '16:00',
    end: '18:00',
    location: 'Verein Amazone',
  });

  for (const id of BOOKMARKED_IDS) {
    await page.goto(`/content/${id}`);
    await page.locator('button[aria-pressed="false"]').click();
    await expect(page.locator('button[aria-pressed="true"]')).toBeVisible();
  }

  await removeDatabaseWarmUpEntries(page);
  // The list shows the newest entry first.
  for (const text of [
    'Buch zurückgeben',
    'Geschenk für Oma besorgen',
    'Schild für die Demo malen',
  ]) {
    await addReminder(page, text);
  }
}

test.describe('store screenshots', () => {
  test('renders the screenshots', async ({ page }, testInfo) => {
    const { dir: outputDir, prefix } = OUTPUT[testInfo.project.name];
    mkdirSync(outputDir, { recursive: true });
    for (const name of readdirSync(outputDir)) {
      if (name.endsWith('.png') && name.startsWith(prefix)) {
        rmSync(join(outputDir, name));
      }
    }

    // `temporal-polyfill` hands out the browser's own Temporal where there is one, and a native
    // `Temporal.Now` reads the system clock, which Playwright's fake clock does not reach. Without
    // it the app falls back to the polyfill, which reads `Date.now()` - and that one is faked.
    await page.addInitScript(() => {
      delete (globalThis as { Temporal?: unknown }).Temporal;
    });
    await page.clock.setFixedTime(NOW);
    await seedDemoData(page);

    const shots: {
      name: string;
      path: string;
      ready: (page: Page) => Promise<unknown>;
      before?: (page: Page) => Promise<unknown>;
      /** Runs after the navigation, for state the route cannot express. */
      prepare?: (page: Page) => Promise<unknown>;
    }[] = [
      {
        name: 'heute',
        path: '/today',
        ready: async (p) => {
          await expect(p.getByText('Kaffee mit Mira')).toBeVisible();
          await expect(p.getByText('Heute ist Feministischer Kampftag!')).toBeVisible();
        },
        before: (p) =>
          p.evaluate(
            ({ day, itemId }) =>
              localStorage.setItem(
                'rk.dailyImpulse',
                JSON.stringify({ day, itemId, recentIds: [itemId], seenDay: day }),
              ),
            { day: TODAY, itemId: IMPULSE_ID },
          ),
      },
      {
        name: 'kalender',
        path: `/calendar?day=${TODAY}`,
        ready: (p) => expect(p.getByRole('link', { name: /Demo!/ })).toBeVisible(),
      },
      {
        name: 'rebellin',
        path: `/content/${REBELLIN_ID}`,
        ready: (p) => expect(p.getByRole('heading', { name: 'Christina Koch' })).toBeVisible(),
      },
      {
        name: 'wissen',
        path: `/content/${WISSEN_ID}`,
        ready: (p) => expect(p.getByRole('heading', { level: 1 })).toBeVisible(),
      },
      {
        name: 'sammlung',
        path: '/content?area=collection',
        ready: (p) => expect(p.getByText('Christina Koch')).toBeVisible(),
      },
      {
        name: 'anlaufstellen',
        path: '/content?area=services',
        // Verein Amazone's own region, so the list opens with Verein Amazone.
        prepare: (p) => p.getByRole('radio', { name: 'Vorarlberg' }).click(),
        ready: (p) => expect(p.getByText('Verein Amazone').first()).toBeVisible(),
      },
      {
        name: 'monat',
        path: `/calendar?view=month&day=${TODAY}`,
        // The month in another colour theme, to show that the app can look different.
        ready: async (p) => {
          await expect(p.getByText('März 2027').first()).toBeVisible();
          await expect(p.locator('html')).toHaveAttribute('data-theme', 'nacht');
        },
        before: async (p) => {
          await p.goto('/settings/theme');
          await p.getByRole('radio', { name: 'Mitternacht' }).check();
        },
      },
    ];

    for (const [index, shot] of shots.entries()) {
      await shot.before?.(page);
      await page.goto(shot.path);
      await shot.prepare?.(page);
      await shot.ready(page);
      await settle(page);
      const file = `${prefix}${String(index + 1).padStart(2, '0')}-${shot.name}.png`;
      await writeOpaquePng(await page.screenshot(), join(outputDir, file));
    }
  });

  test('renders the Play feature graphic', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'play', 'Only the Play listing has a feature graphic.');

    await renderGraphic(
      page,
      { width: 1024, height: 500, scale: 1 },
      PLAY_IMAGES,
      'featureGraphic',
    );
  });

  test('renders the App Store header and search results assets', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'app-store', 'Only the App Store has these assets.');

    // The header spans the top of the product page and is cropped to the screen on a phone, so the
    // logo stays small and central. The search results asset stands in for the screenshots in a
    // search result card; it takes the feature graphic's layout, scaled up.
    await renderGraphic(
      page,
      { width: 3840, height: 1646, scale: 2.4 },
      APP_STORE_ASSETS,
      'header',
    );
    await renderGraphic(
      page,
      { width: 1920, height: 1280, scale: 1.75 },
      APP_STORE_ASSETS,
      'search-results',
    );
  });
});

/** Renders the brand graphic at a store's pixel size and writes it as `<dir>/<name>.png`. */
async function renderGraphic(
  page: Page,
  size: { width: number; height: number; scale: number },
  dir: string,
  name: string,
): Promise<void> {
  await page.setViewportSize({ width: size.width, height: size.height });
  await page.setContent(brandGraphicHtml(size), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);

  mkdirSync(dir, { recursive: true });
  // The graphic is specified in pixels, so it is captured at 1x regardless of the project's density.
  const png = await page.locator('main').screenshot({ scale: 'css' });
  await writeOpaquePng(png, join(dir, `${name}.png`));
}

/** Inlines a bundled font, so `setContent` - which has no base URL - can use it. */
function fontFace(family: string, file: string, weight: string): string {
  const data = readFileSync(
    join(ROOT, 'node_modules', '@amazone', 'design-system', 'src', 'fonts', file),
  ).toString('base64');
  return `@font-face { font-family: '${family}'; font-weight: ${weight}; src: url(data:font/woff2;base64,${data}) format('woff2'); }`;
}

/**
 * The brand graphic behind the Play feature graphic and the App Store header and search results
 * assets: the app icon and name on the Amazone theme's teal, which the navy icon stands out from,
 * like on the website's start page. The stores crop the edges of these graphics, so everything that
 * matters sits in the middle. `scale` grows the icon and the text from the feature graphic's sizes.
 */
function brandGraphicHtml(size: { width: number; height: number; scale: number }): string {
  const icon = readFileSync(join(ROOT, 'resources', 'app-icons', 'cool-cat-nacht.png')).toString(
    'base64',
  );
  const px = (value: number): string => `${value * size.scale}px`;

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<style>
  ${fontFace('Fredoka', 'fredoka-latin.woff2', '300 700')}
  ${fontFace('Inter', 'inter-latin.woff2', '100 900')}
  html, body { margin: 0; }
  main {
    width: ${size.width}px; height: ${size.height}px; box-sizing: border-box;
    display: flex; align-items: center; justify-content: center; gap: ${px(56)};
    background: #7dbdbb; color: #15195f;
  }
  img { width: ${px(232)}; height: ${px(232)}; border-radius: ${px(52)}; }
  h1 { font-family: 'Fredoka', sans-serif; font-weight: 600; font-size: ${px(64)}; line-height: 1.05; margin: 0; }
  p { font-family: 'Inter', sans-serif; font-size: ${px(28)}; line-height: 1.35; margin: ${px(20)} 0 0; color: #15195f; }
</style>
</head>
<body>
<main>
  <img src="data:image/png;base64,${icon}" alt="">
  <div>
    <h1>Rebell*innen</h1>
    <p>Dein feministischer Kalender.<br>Ohne Konto. Alles bleibt bei dir.</p>
  </div>
</main>
</body>
</html>`;
}
