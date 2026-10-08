import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

import {
  removeDatabaseWarmUpEntries,
  seedAppCalendar,
  seedOccurrence,
} from '../../e2e/support/calendar-seed';

/**
 * The store screenshots and the Play feature graphic, rendered from the production web build (see
 * playwright.store.config.ts and docs/store-listing.md).
 *
 * Everything that would make two runs differ is pinned: the clock (a fixed Sunday, Weltfrauentag,
 * so Heute's impulse is always the same one), the zone and locale, the demo data, and the fonts,
 * which the app bundles. Run it, look at every PNG, and commit them.
 */

/** Playwright runs from the repository root, like `e2e/support/developer-tools.ts` assumes. */
const ROOT = process.cwd();

/** Where each store's tool reads its screenshots from, in upload order by file name. */
const OUTPUT: Record<string, string> = {
  'app-store': join(ROOT, 'fastlane', 'screenshots', 'de-DE'),
  play: join(ROOT, 'fastlane', 'metadata', 'android', 'de-DE', 'images', 'phoneScreenshots'),
};

const PLAY_IMAGES = join(ROOT, 'fastlane', 'metadata', 'android', 'de-DE', 'images');

/** Sunday, 8 March 2026, 9:30 in Vienna. */
const NOW = new Date('2026-03-08T09:30:00+01:00');
const TODAY = '2026-03-08';

/**
 * The content the screenshots show. Rebell*innen whose portraits are in the public domain and
 * Wissensimpulse illustrated by Verein Amazone itself, so no screenshot carries third-party licence
 * terms into the store (see `public/image-attributions.json`).
 */
const REBELLIN_ID = 'reb-09';
const WISSEN_ID = 'wi-10';
const BOOKMARKED_IDS = [REBELLIN_ID, WISSEN_ID, 'reb-33', 'wi-08'];

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

/** The demo data every screenshot shows: a believable Sunday in March. */
async function seedDemoData(page: Page): Promise<void> {
  await seedAppCalendar(page, 'Mein Kalender');
  await seedOccurrence(page, {
    sourceType: 'ics',
    title: 'Internationaler Frauentag',
    day: TODAY,
    calendarName: 'Rebell*innen Kalender',
    color: '#7B3FA8',
  });

  await addAppointment(page, {
    title: 'Demo zum Frauentag',
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
    ['Chorprobe', '2026-03-03', '19:00', '21:00'],
    ['Zahnarzt', '2026-03-05', '08:30', '09:00'],
    ['Lesekreis', '2026-03-12', '19:00', '20:30'],
    ['Konzert mit Jule', '2026-03-20', '20:00', '22:30'],
    ['Oma besuchen', '2026-03-22', '15:00', '18:00'],
  ]) {
    await addAppointment(page, { title, day, start, end });
  }
  await addAppointment(page, {
    title: 'Workshop Rebell*innen Kalender',
    day: '2026-03-10',
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
    const outputDir = OUTPUT[testInfo.project.name];
    rmSync(outputDir, { recursive: true, force: true });
    mkdirSync(outputDir, { recursive: true });

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
    }[] = [
      {
        name: 'heute',
        path: '/today',
        ready: (p) => expect(p.getByText('Kaffee mit Mira')).toBeVisible(),
      },
      {
        name: 'kalender',
        path: `/calendar?day=${TODAY}`,
        ready: (p) => expect(p.getByRole('link', { name: /Demo zum Frauentag/ })).toBeVisible(),
      },
      {
        name: 'rebellin',
        path: `/content/${REBELLIN_ID}`,
        ready: (p) => expect(p.getByRole('heading', { name: 'Ada Lovelace' })).toBeVisible(),
      },
      {
        name: 'wissen',
        path: `/content/${WISSEN_ID}`,
        ready: (p) => expect(p.getByRole('heading', { level: 1 })).toBeVisible(),
      },
      {
        name: 'sammlung',
        path: '/content?area=collection',
        ready: (p) => expect(p.getByText('Marie Curie')).toBeVisible(),
      },
      {
        name: 'anlaufstellen',
        path: '/content?area=services',
        ready: (p) => expect(p.getByText('Rat auf Draht')).toBeVisible(),
      },
      {
        name: 'monat',
        path: `/calendar?view=month&day=${TODAY}`,
        // The month in another colour theme, to show that the app can look different.
        ready: async (p) => {
          await expect(p.getByText('März 2026').first()).toBeVisible();
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
      await shot.ready(page);
      await settle(page);
      const file = `${String(index + 1).padStart(2, '0')}-${shot.name}.png`;
      await writeOpaquePng(await page.screenshot(), join(outputDir, file));
    }
  });

  test('renders the Play feature graphic', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'play', 'Only the Play listing has a feature graphic.');

    await page.setViewportSize({ width: 1024, height: 500 });
    await page.setContent(featureGraphicHtml(), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);

    mkdirSync(PLAY_IMAGES, { recursive: true });
    // The graphic is specified in pixels, so it is captured at 1x regardless of the project's density.
    const png = await page.locator('main').screenshot({ scale: 'css' });
    await writeOpaquePng(png, join(PLAY_IMAGES, 'featureGraphic.png'));
  });
});

/** Inlines a bundled font, so `setContent` - which has no base URL - can use it. */
function fontFace(family: string, file: string, weight: string): string {
  const data = readFileSync(join(ROOT, 'src', 'styles', 'fonts', file)).toString('base64');
  return `@font-face { font-family: '${family}'; font-weight: ${weight}; src: url(data:font/woff2;base64,${data}) format('woff2'); }`;
}

/**
 * The feature graphic: the app icon and name on the Amazone theme's navy. Play shows it above the
 * screenshots and sometimes crops its edges, so everything that matters sits in the middle.
 */
function featureGraphicHtml(): string {
  const icon = readFileSync(join(ROOT, 'resources', 'app-icons', 'klassisch.png')).toString(
    'base64',
  );

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<style>
  ${fontFace('Fredoka', 'fredoka-latin.woff2', '300 700')}
  ${fontFace('Inter', 'inter-latin.woff2', '100 900')}
  html, body { margin: 0; }
  main {
    width: 1024px; height: 500px; box-sizing: border-box;
    display: flex; align-items: center; justify-content: center; gap: 56px;
    background: #15195f; color: #fffdf6;
  }
  img { width: 232px; height: 232px; border-radius: 52px; }
  h1 { font-family: 'Fredoka', sans-serif; font-weight: 600; font-size: 64px; line-height: 1.05; margin: 0; }
  p { font-family: 'Inter', sans-serif; font-size: 28px; line-height: 1.35; margin: 20px 0 0; color: #7dbdbb; }
</style>
</head>
<body>
<main>
  <img src="data:image/png;base64,${icon}" alt="">
  <div>
    <h1>Rebell*innen<br>Kalender</h1>
    <p>Dein Kalender von Verein Amazone.<br>Ohne Konto. Alles bleibt bei dir.</p>
  </div>
</main>
</body>
</html>`;
}
