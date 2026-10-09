import { test, expect } from '@playwright/test';
import { expectNoBlockingViolations } from './support/a11y';
import { developerToolsEnabled } from './support/developer-tools';

test.describe('application shell', () => {
  test('starts on the Today page', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/today$/);
    // Today's `h1` is the greeting itself, which depends on the time of day.
    await expect(
      page.getByRole('heading', { name: /^(Guten Morgen|Hallo|Guten Abend)/, level: 1 }),
    ).toBeVisible();
  });

  test('navigates between the primary destinations', async ({ page }) => {
    await page.goto('/');

    const navigation = page.getByRole('navigation', { name: 'Hauptbereiche' });
    await expect(navigation.getByRole('link', { name: 'Heute' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await navigation.getByRole('link', { name: 'Kalender' }).click();

    await expect(page).toHaveURL(/\/calendar$/);
    await expect(navigation.getByRole('link', { name: 'Kalender' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('hides the bottom navigation on a focused screen and returns from it', async ({ page }) => {
    await page.goto('/calendar');
    await page.getByRole('link', { name: 'Neuer Termin' }).click();

    // Carries the day the agenda was showing as `?day=`, so no `$` anchor here.
    await expect(page).toHaveURL(/\/calendar\/event\/new\?day=/);
    await expect(page.getByRole('navigation', { name: 'Hauptbereiche' })).toBeHidden();
    // Creation screens dismiss with "Schließen", not "Zurück".
    await expect(page.getByRole('heading', { name: 'Neuer Termin', level: 1 })).toBeFocused();

    await page.getByRole('button', { name: 'Schließen' }).click();

    // Closing returns to the calendar view the screen was opened from, which the „Neuer Termin"
    // link carried into it - the default week view here.
    await expect(page).toHaveURL(/\/calendar\?view=week$/);
    await expect(page.getByRole('navigation', { name: 'Hauptbereiche' })).toBeVisible();
    // Closing must not drop focus to the body.
    await expect(page.getByRole('heading', { name: 'Kalender', level: 1 })).toBeFocused();
  });

  test('returns from a page under „Über die App“ to „Über die App“, not to the settings', async ({
    page,
  }) => {
    for (const name of ['Bildnachweise', 'Open-Source-Lizenzen']) {
      await page.goto('/settings/about');
      await page.getByRole('link', { name }).click();
      await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();

      await page.getByRole('button', { name: 'Zurück' }).click();

      await expect(page).toHaveURL(/\/settings\/about$/);
    }
  });

  test('pages the calendar by dragging the grid sideways, and still selects a tapped day', async ({
    page,
  }) => {
    await page.goto('/calendar?view=week&day=2026-08-05');

    const grid = page.locator('app-calendar-grid');
    const box = (await grid.boundingBox())!;
    const y = box.y + box.height / 2;

    await page.mouse.move(box.x + box.width - 20, y);
    await page.mouse.down();
    await page.mouse.move(box.x + 20, y, { steps: 10 });
    await page.mouse.up();

    await expect(page).toHaveURL(/day=2026-08-12/);

    // The drag must not also select whatever day it ended on, but a plain tap still has to work.
    await page.getByRole('button', { name: /13\./ }).first().click();
    await expect(page).toHaveURL(/day=2026-08-13/);
  });

  test('returns to Heute from a screen opened there', async ({ page }) => {
    await page.goto('/today');
    await page.getByRole('link', { name: 'Neuer Termin' }).click();

    await expect(page).toHaveURL(/\/calendar\/event\/new\?/);

    await page.getByRole('button', { name: 'Schließen' }).click();

    await expect(page).toHaveURL(/\/today$/);
    await expect(page.getByRole('navigation', { name: 'Hauptbereiche' })).toBeVisible();
  });

  test('does not move focus when switching primary destinations', async ({ page }) => {
    await page.goto('/');

    const calendarLink = page
      .getByRole('navigation', { name: 'Hauptbereiche' })
      .getByRole('link', { name: 'Kalender' });
    await calendarLink.click();

    await expect(page).toHaveURL(/\/calendar$/);
    await expect(calendarLink).toBeFocused();

    // The announcer must stay off-screen. Without @angular/cdk/a11y-prebuilt.css the
    // .cdk-visually-hidden class has no rules and the element renders as visible page content.
    const announcer = page.locator('.cdk-live-announcer-element');
    await expect(announcer).toHaveText('Kalender');
    const box = await announcer.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(1);
    expect(box?.height).toBeLessThanOrEqual(1);
  });

  test('keeps the selected colour theme after a reload', async ({ page }) => {
    await page.goto('/settings/theme');
    await page.getByRole('radio', { name: 'Mitternacht' }).check();

    await page.reload();

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'nacht');
    await expect(page.getByRole('radio', { name: 'Mitternacht' })).toBeChecked();
  });

  test('follows the device between light and dark on the system theme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/settings/theme');
    await page.getByRole('radio', { name: 'Systemeinstellung', exact: false }).check();

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'nacht');

    // No reload: flipping the device setting while the app is open recolours it at once.
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'amazone');
    await expect(
      page.getByRole('radio', { name: 'Systemeinstellung', exact: false }),
    ).toBeChecked();
  });

  test('offers every approved settings entry', async ({ page }) => {
    await page.goto('/settings');

    for (const [heading, entries] of [
      ['Persönlich', ['Profil']],
      ['Darstellung & Bedienung', ['Farbthema', 'Textgröße', 'Animationen', 'Vibration']],
      ['Heute', ['Tagesimpuls', 'Nicht vergessen']],
      ['Kalender', ['Kalender verwalten', 'Benachrichtigungen']],
      ['App & Rechtliches', ['Über die App', 'Einführung ansehen', 'Datenschutz', 'Impressum']],
    ] as const) {
      await expect(page.getByRole('heading', { name: heading, level: 2 })).toBeVisible();
      for (const entry of entries) {
        // Substring match: entries that show their current value carry it in their accessible
        // name ("Farbthema Amazone").
        await expect(page.getByRole('link', { name: entry, exact: false })).toBeVisible();
      }
    }

    // The entries that carry a value show it, so the current selection is readable without
    // opening the screen.
    await expect(page.getByRole('link', { name: 'Farbthema', exact: false })).toContainText(
      'Amazone',
    );
  });

  test('keeps the selected motion preference after a reload', async ({ page }) => {
    await page.goto('/settings/motion');
    await page.getByRole('radio', { name: 'Reduziert', exact: false }).check();

    await page.reload();

    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
    await expect(page.getByRole('radio', { name: 'Reduziert', exact: false })).toBeChecked();
  });

  test('greets with the Tagesimpuls on every opening, but not on a tab switch', async ({
    page,
  }) => {
    const greeting = page.locator('app-today-impulse .rk-arrived');

    await page.goto('/today');
    await expect(greeting).toHaveCount(1);

    // Switching tabs inside the app is not an opening.
    await page.getByRole('link', { name: 'Kalender' }).click();
    await page.getByRole('link', { name: 'Heute' }).click();
    await expect(page.locator('app-today-impulse')).toBeVisible();
    await expect(greeting).toHaveCount(0);

    // A return from the background is. In the browser build `visibilitychange` stands in for it.
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(greeting).toHaveCount(1);
  });

  test('keeps the Tagesimpuls and vibration choices after a reload', async ({ page }) => {
    await page.goto('/settings/impulse');
    await page.getByRole('radio', { name: 'Einmal am Tag', exact: false }).check();
    await page.goto('/settings/vibration');
    await page.getByRole('radio', { name: 'Aus', exact: false }).check();

    await page.goto('/settings');

    await expect(page.getByRole('link', { name: 'Tagesimpuls', exact: false })).toContainText(
      'Einmal am Tag',
    );
    await expect(page.getByRole('link', { name: 'Vibration', exact: false })).toContainText('Aus');
  });

  test('explains on the Tagesimpuls screen why it holds still under reduced animations', async ({
    page,
  }) => {
    await page.goto('/settings/motion');
    await page.getByRole('radio', { name: 'Reduziert', exact: false }).check();

    await page.goto('/settings/impulse');

    await expect(page.getByText('Animationen sind reduziert', { exact: false })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Animationen ändern' })).toBeVisible();
  });

  /**
   * WCAG 2.2 SC 2.4.2: every view needs a title that describes it. Angular's default
   * `TitleStrategy` writes the route's `title` to `document.title`, so this only holds as long as
   * every route declares one - a new route without it silently keeps the previous screen's title.
   * Give a new route a `title` and add it here.
   */
  test('gives every route its own document title', async ({ page }) => {
    for (const [path, title] of [
      ['/today', 'Heute'],
      ['/calendar', 'Kalender'],
      ['/calendar/event/new', 'Neuer Termin'],
      ['/content', 'Inhalte'],
      ['/settings', 'Einstellungen'],
      ['/settings/theme', 'Farbthema'],
      ['/settings/text-size', 'Textgröße'],
      ['/settings/motion', 'Animationen'],
      ['/settings/vibration', 'Vibration'],
      ['/settings/impulse', 'Tagesimpuls'],
      ['/settings/reminders', 'Nicht vergessen'],
      ['/settings/calendars', 'Kalender verwalten'],
      ['/settings/notifications', 'Benachrichtigungen'],
      ['/settings/about', 'Über die App'],
      ...(developerToolsEnabled ? [['/settings/dev-tools', 'Entwickler-Werkzeuge'] as const] : []),
      ['/intro/1', 'Einführung'],
    ] as const) {
      await page.goto(path);

      await expect(page).toHaveTitle(title);
    }
  });

  test('has no serious or critical accessibility violations on Today', async ({ page }) => {
    await page.goto('/');

    await expectNoBlockingViolations(page);
  });

  test('has no serious or critical accessibility violations in settings', async ({ page }) => {
    await page.goto('/settings');

    await expectNoBlockingViolations(page);
  });

  test('has no serious or critical accessibility violations on the theme screen', async ({
    page,
  }) => {
    await page.goto('/settings/theme');

    await expectNoBlockingViolations(page);
  });

  test('has no serious or critical accessibility violations on the Tagesimpuls settings', async ({
    page,
  }) => {
    await page.goto('/settings/impulse');

    await expectNoBlockingViolations(page);
  });

  test('has no serious or critical accessibility violations on the reminder settings', async ({
    page,
  }) => {
    await page.goto('/settings/reminders');

    await expectNoBlockingViolations(page);
  });

  test('has no serious or critical accessibility violations on calendar management', async ({
    page,
  }) => {
    await page.goto('/settings/calendars');

    await expectNoBlockingViolations(page);
  });
});
