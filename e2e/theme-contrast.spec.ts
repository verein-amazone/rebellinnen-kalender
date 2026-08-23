import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seedAppCalendar, seedOccurrence } from './support/calendar-seed';

type Page = import('@playwright/test').Page;

/** Must match the `[data-theme='…']` blocks in src/styles/theme.css. */
const THEMES = ['amazone', 'warm', 'nacht', 'lila'] as const;

/**
 * Seeds the stored preference before the app boots, so the theme is already applied on first paint
 * and no test has to click through the settings UI to get there.
 */
async function selectTheme(page: Page, theme: (typeof THEMES)[number]) {
  await page.addInitScript((value) => {
    window.localStorage.setItem('rk.appearance', JSON.stringify({ theme: value }));
  }, theme);
}

/**
 * Every theme is a separate palette, so contrast has to be checked per theme rather than once. The
 * status colours added with the design system multiply the number of pairs, and this is what keeps
 * that from drifting silently.
 */
test.describe('colour contrast per theme', () => {
  for (const theme of THEMES) {
    for (const path of ['/today', '/calendar', '/calendar?view=month', '/settings']) {
      test(`${theme} has sufficient contrast on ${path}`, async ({ page }) => {
        await selectTheme(page, theme);
        await page.goto(path);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

        const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();

        expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
      });
    }

    /**
     * The loop above walks paths, and neither a menu nor a sheet has one — so those two are the screen
     * states it cannot reach. Together they cover the danger colour on a card and the sheet's field,
     * label and action buttons.
     */
    test(`${theme} has sufficient contrast with an open menu and sheet`, async ({ page }) => {
      await selectTheme(page, theme);
      await page.goto('/today');
      await page.getByRole('button', { name: 'Punkt hinzufügen' }).click();
      const addDialog = page.getByRole('dialog', { name: 'Neue Erinnerung' });
      await addDialog.getByLabel('Text der Erinnerung').fill('Blumen gießen');
      await addDialog.getByRole('button', { name: 'Speichern' }).click();
      await page.getByRole('button', { name: 'Optionen für „Blumen gießen“' }).click();
      await expect(page.getByRole('menuitem', { name: 'Löschen' })).toBeVisible();

      const menuResults = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
      expect(menuResults.violations, JSON.stringify(menuResults.violations, null, 2)).toEqual([]);

      await page.getByRole('menuitem', { name: 'Bearbeiten' }).click();
      await expect(page.getByRole('dialog', { name: 'Erinnerung bearbeiten' })).toBeVisible();

      const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();

      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
    });

    /**
     * #19's appointment screens and dialogs, none of which the path loop above reaches: the
     * three `actions` combinations a detail read view can render (app-owned, a writable device
     * event, a read-only one), the in-place edit view, the "Neuer Termin" form, and the two sheets
     * calendar delete/edit can now open — `ConfirmationDialog` and `RecurrenceScopeDialog`.
     */
    test(`${theme} has sufficient contrast on appointment screens`, async ({ page }) => {
      await selectTheme(page, theme);

      const checkContrast = async () => {
        const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
        expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
      };

      await seedAppCalendar(page, 'Testkalender');
      await page.goto('/calendar/event/new');
      await checkContrast();

      const app = await seedOccurrence(page, {
        sourceType: 'app',
        title: 'App-Termin',
        day: '2026-09-11',
        recurring: true,
      });
      await page.goto(`/calendar/event/${app.occurrenceId}`);
      await expect(page.getByRole('button', { name: 'Bearbeiten' })).toBeVisible();
      await checkContrast();

      await page.getByRole('button', { name: 'Bearbeiten' }).click();
      await checkContrast();

      // No "Abbrechen" button any more — the header back-arrow cancels edit mode (see
      // `EventDetailPage.handleBeforeDismiss`).
      await page.getByRole('button', { name: 'Zurück' }).click();
      await page.getByRole('button', { name: 'Löschen' }).click();
      const confirmation = page.getByRole('dialog', { name: 'Termin löschen?' });
      await expect(confirmation).toBeVisible();
      await checkContrast();

      await confirmation.getByRole('button', { name: 'Löschen' }).click();
      const scope = page.getByRole('dialog', { name: 'Was möchtest du löschen?' });
      await expect(scope).toBeVisible();
      await checkContrast();
      await scope.getByRole('button', { name: 'Abbrechen' }).click();

      const device = await seedOccurrence(page, {
        sourceType: 'device',
        calendarWritable: true,
        title: 'Geräte-Termin',
        day: '2026-09-12',
      });
      await page.goto(`/calendar/event/${device.occurrenceId}`);
      await expect(page.getByRole('button', { name: 'In Kalender-App bearbeiten' })).toBeVisible();
      await checkContrast();

      const readOnly = await seedOccurrence(page, {
        sourceType: 'ics',
        title: 'ICS-Termin',
        day: '2026-09-13',
      });
      await page.goto(`/calendar/event/${readOnly.occurrenceId}`);
      await expect(page.getByText('schreibgeschützt')).toBeVisible();
      await checkContrast();
    });
  }
});
