import { test, expect } from '@playwright/test';
import { expectNoBlockingViolations } from './support/a11y';

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

  test('offers every approved settings entry', async ({ page }) => {
    await page.goto('/settings');

    for (const [heading, entries] of [
      ['Persönlich', ['Profil']],
      [
        'Darstellung & Bedienung',
        ['Farbthema', 'Textgröße', 'Bewegung & Animationen', 'Nicht vergessen'],
      ],
      ['Kalender', ['Kalender verwalten']],
      ['App & Rechtliches', ['Über die App', 'Datenschutz', 'Impressum']],
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
      ['/settings/motion', 'Bewegung & Animationen'],
      ['/settings/reminders', 'Nicht vergessen'],
      ['/settings/calendars', 'Kalender verwalten'],
      ['/settings/about', 'Über die App'],
      ['/settings/dev-tools', 'Entwickler-Werkzeuge'],
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
