import { test, expect, type Page } from '@playwright/test';
import { expectNoBlockingViolations } from './support/a11y';
import { seedAppCalendar } from './support/calendar-seed';

/**
 * Recurring appointments (#80): a series created through the form, then edited and deleted through
 * each recurrence scope. Monday 10 August 2026 is the first occurrence throughout.
 */

async function createWeeklySeries(page: Page, title: string, count: number): Promise<void> {
  await seedAppCalendar(page, 'Testkalender');
  await page.goto('/calendar/event/new?day=2026-08-10');
  await expect(page.getByRole('button').filter({ hasText: 'Testkalender' })).toBeVisible();
  await page.getByLabel('Titel').fill(title);

  await page.locator('#event-form-date-time button').first().click();
  await page.getByLabel('Startzeit').fill('18:00');
  await page.getByLabel('Endzeit').fill('19:00');

  await page.getByRole('button', { name: /Wiederholen/ }).click();
  await page.getByLabel('Wiederholung').selectOption('weekly');
  await page.getByRole('radio', { name: 'Nach einer Anzahl von Terminen' }).check();
  await page.getByLabel(/^Nach/).fill(String(count));
  await expect(page.getByRole('button', { name: /Wiederholen/ })).toContainText(
    `Jede Woche am Montag, ${count} Mal`,
  );

  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page).toHaveURL(/\/calendar\?day=2026-08-10/);
}

function occurrenceLink(page: Page, title: string) {
  return page.getByRole('link', { name: new RegExp(`${title}.*wiederholt sich`) });
}

test.describe('recurring appointments', () => {
  test('creates a weekly series and shows every occurrence as part of it', async ({ page }) => {
    await createWeeklySeries(page, 'Plenum', 3);
    await expect(occurrenceLink(page, 'Plenum')).toBeVisible();

    await page.goto('/calendar?day=2026-08-24');
    await expect(occurrenceLink(page, 'Plenum')).toBeVisible();

    await page.goto('/calendar?day=2026-08-31');
    await expect(page.getByRole('link', { name: /Plenum/ })).toHaveCount(0);

    await page.goto('/calendar?day=2026-08-17');
    await occurrenceLink(page, 'Plenum').click();
    await expect(page.getByText('Jede Woche am Montag, 3 Mal')).toBeVisible();
    await expectNoBlockingViolations(page);
  });

  test('edits this and the following occurrences', async ({ page }) => {
    await createWeeklySeries(page, 'Chor', 3);

    await page.goto('/calendar?day=2026-08-17');
    await occurrenceLink(page, 'Chor').click();
    await page.getByRole('button', { name: 'Bearbeiten' }).click();
    await page.getByLabel('Titel').fill('Chorprobe');
    await page.getByRole('button', { name: 'Speichern' }).click();

    const scope = page.getByRole('dialog', { name: 'Was möchtest du ändern?' });
    await scope.getByRole('radio', { name: 'Dieser und folgende Termine' }).check();
    await scope.getByRole('button', { name: 'Bestätigen' }).click();
    // Saving ends on the occurrence's day; wait for it before navigating away mid-write.
    await expect(page).toHaveURL(/\/calendar\?day=2026-08-17/);

    await page.goto('/calendar?day=2026-08-10');
    await expect(occurrenceLink(page, 'Chor')).toBeVisible();
    await expect(page.getByRole('link', { name: /Chorprobe/ })).toHaveCount(0);
    await page.goto('/calendar?day=2026-08-24');
    await expect(page.getByRole('link', { name: /Chorprobe/ })).toBeVisible();
    // Still three appointments in all: the continuation keeps what is left of the count.
    await page.goto('/calendar?day=2026-08-31');
    await expect(page.getByRole('link', { name: /Chor/ })).toHaveCount(0);
  });

  test('offers no single-occurrence scope once the repetition changes', async ({ page }) => {
    await createWeeklySeries(page, 'Sport', 3);

    await occurrenceLink(page, 'Sport').click();
    await page.getByRole('button', { name: 'Bearbeiten' }).click();
    await page.getByRole('button', { name: /Wiederholen/ }).click();
    await page.getByLabel('Wiederholung').selectOption('daily');
    await page.getByRole('button', { name: 'Speichern' }).click();

    const scope = page.getByRole('dialog', { name: 'Was möchtest du ändern?' });
    await expect(scope.getByRole('radio', { name: 'Nur dieser Termin' })).toHaveCount(0);
    await scope.getByRole('radio', { name: 'Alle Termine' }).check();
    await scope.getByRole('button', { name: 'Bestätigen' }).click();
    await expect(page).toHaveURL(/\/calendar\?day=2026-08-10/);

    await page.goto('/calendar?day=2026-08-11');
    await expect(page.getByRole('link', { name: /Sport/ })).toBeVisible();
  });

  test('deletes a single occurrence and keeps the rest of the series', async ({ page }) => {
    await createWeeklySeries(page, 'Lesekreis', 3);

    await page.goto('/calendar?day=2026-08-17');
    await occurrenceLink(page, 'Lesekreis').click();
    await page.getByRole('button', { name: 'Löschen' }).click();
    await page
      .getByRole('dialog', { name: 'Termin löschen?' })
      .getByRole('button', { name: 'Löschen' })
      .click();

    const scope = page.getByRole('dialog', { name: 'Was möchtest du löschen?' });
    await scope.getByRole('radio', { name: 'Nur dieser Termin' }).check();
    await scope.getByRole('button', { name: 'Bestätigen' }).click();

    await expect(page).toHaveURL(/\/calendar\?day=2026-08-17/);
    await expect(page.getByRole('link', { name: /Lesekreis/ })).toHaveCount(0);
    await page.goto('/calendar?day=2026-08-24');
    await expect(occurrenceLink(page, 'Lesekreis')).toBeVisible();
  });
});
