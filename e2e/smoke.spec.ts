import { test, expect } from '@playwright/test';
import { expectNoBlockingViolations } from './support/a11y';
import { seedAppCalendar, seedDeviceCalendar, seedOccurrence } from './support/calendar-seed';

/**
 * Functional coverage for #19 (view and manage appointments): creating, editing and deleting an
 * app-owned appointment, viewing a read-only one, and — flagged as still missing in #29's notes,
 * since nothing opened a sheet in a real browser before #19 — a full sheet interaction: focus
 * trapped inside while open, Escape closes it, focus returns to the opener, and the page behind
 * does not scroll.
 *
 * There is no calendar-management screen yet (`Kalender verwalten` is a stub, issue #20), so the
 * appointment form's calendar picker has nothing to offer out of the box. `seedAppCalendar` and
 * `seedOccurrence` (`e2e/support/calendar-seed.ts`) write straight into the SQLite database to work
 * around that; see that file for why and how.
 */
test.describe('appointments', () => {
  test('creates a plain appointment and finds it in the calendar', async ({ page }) => {
    await seedAppCalendar(page, 'Testkalender');

    // Matches the real entry point (the agenda's „Neuer Termin" link, which always carries a
    // `?day=`): the form prefills date/end-date from it, same as `NewEventPage.day`.
    await page.goto('/calendar/event/new?day=2026-08-10');
    // The only writable calendar is auto-selected (see `EventForm.applyDefaultCalendar`) — no
    // picker interaction needed.
    await expect(page.getByRole('button').filter({ hasText: 'Testkalender' })).toBeVisible();
    await page.getByLabel('Titel').fill('Vereinstreffen');

    // The date/time fields start collapsed behind a summary row (`date-time-field.html`).
    await page.locator('#event-form-date-time button').first().click();
    await page.getByLabel('Startzeit').fill('18:00');
    await page.getByLabel('Endzeit').fill('19:00');
    await page.getByRole('button', { name: 'Speichern' }).click();

    await expect(page).toHaveURL(/\/calendar\?day=2026-08-10/);
    await expect(page.getByRole('link', { name: /Vereinstreffen/ })).toBeVisible();
  });

  test('edits a standalone appointment in place', async ({ page }) => {
    const { occurrenceId } = await seedOccurrence(page, {
      sourceType: 'app',
      title: 'Vorstandssitzung',
      day: '2026-09-02',
    });

    await page.goto(`/calendar/event/${occurrenceId}`);
    await page.getByRole('button', { name: 'Bearbeiten' }).click();

    await page.getByLabel('Titel').fill('Vorstandssitzung (verschoben)');
    await page.getByRole('button', { name: 'Speichern' }).click();

    await expect(page).toHaveURL(/\/calendar\?day=/);
    await expect(page.getByRole('link', { name: /Vorstandssitzung \(verschoben\)/ })).toBeVisible();
  });

  test('deletes a standalone appointment after confirming', async ({ page }) => {
    const { occurrenceId } = await seedOccurrence(page, {
      sourceType: 'app',
      title: 'Abzusagender Termin',
      day: '2026-09-03',
    });

    await page.goto(`/calendar/event/${occurrenceId}`);
    await page.getByRole('button', { name: 'Löschen' }).click();

    const confirmation = page.getByRole('dialog', { name: 'Termin löschen?' });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: 'Löschen' }).click();

    await expect(page).toHaveURL(/\/calendar\?day=2026-09-03/);
    await expect(page.getByRole('link', { name: /Abzusagender Termin/ })).toHaveCount(0);
  });

  test('shows a read-only device appointment with only the native-calendar action', async ({
    page,
  }) => {
    const { occurrenceId } = await seedOccurrence(page, {
      sourceType: 'device',
      calendarWritable: true,
      title: 'Zahnarzttermin',
      day: '2026-09-04',
    });

    await page.goto(`/calendar/event/${occurrenceId}`);

    await expect(page.getByRole('heading', { name: 'Zahnarzttermin' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bearbeiten', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Löschen', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'In Kalender-App bearbeiten' })).toBeVisible();
  });

  /**
   * The sheet scenario #29's notes flagged as still missing: nothing opened a sheet in a real
   * browser before #19 added the first reachable one (`ConfirmationDialog` from calendar delete).
   * Covers what `SheetService` promises: a trapped focus, Escape dismissal, focus returned to the
   * opener, and the shell behind made both inert and non-scrollable while the sheet is open.
   */
  test('a sheet traps focus, closes on Escape, and blocks the page behind it', async ({ page }) => {
    const { occurrenceId } = await seedOccurrence(page, {
      sourceType: 'app',
      title: 'Löschbarer Termin',
      day: '2026-09-05',
    });

    await page.goto(`/calendar/event/${occurrenceId}`);
    const opener = page.getByRole('button', { name: 'Löschen' });
    await opener.click();

    const sheet = page.getByRole('dialog', { name: 'Termin löschen?' });
    await expect(sheet).toBeVisible();

    // No serious/critical axe violations while the sheet is the topmost, focus-trapping layer.
    await expectNoBlockingViolations(page);

    // Focus lands on the sheet's own heading (see sheet.html's `cdkFocusInitial`), inside the panel.
    await expect(sheet.getByRole('heading', { name: 'Termin löschen?' })).toBeFocused();

    // The shell behind is inert while the sheet is open — Tab and a pointer cannot reach it.
    await expect(page.locator('app-root')).toHaveAttribute('inert', '');

    // The app's own scroll region is <main> (see large-text.spec.ts), covered by the sheet's
    // backdrop while it is open; a wheel gesture over the page must not move it underneath.
    const scrollBefore = await page.evaluate(() => document.querySelector('main')?.scrollTop ?? 0);
    await page.mouse.wheel(0, 2000);
    expect(await page.evaluate(() => document.querySelector('main')?.scrollTop ?? 0)).toBe(
      scrollBefore,
    );

    await page.keyboard.press('Escape');

    await expect(sheet).toBeHidden();
    // Escape must return focus to the button that opened the sheet, not drop it to the body.
    await expect(opener).toBeFocused();
    await expect(page.locator('app-root')).not.toHaveAttribute('inert', '');
  });

  test('has no serious or critical accessibility violations on the appointment detail page', async ({
    page,
  }) => {
    const { occurrenceId } = await seedOccurrence(page, {
      sourceType: 'app',
      title: 'Zugängliche Sitzung',
      day: '2026-09-06',
    });

    await page.goto(`/calendar/event/${occurrenceId}`);

    await expectNoBlockingViolations(page);
  });

  test('has no serious or critical accessibility violations on the new-appointment form', async ({
    page,
  }) => {
    await seedAppCalendar(page, 'Testkalender');

    await page.goto('/calendar/event/new');

    await expectNoBlockingViolations(page);
  });
});

/**
 * Functional coverage for #20 (manage the app calendar and device calendars). The device
 * connection flow itself (requesting OS permission) has no web equivalent and cannot run under
 * Playwright, so these scenarios seed an already-connected device source straight into SQLite —
 * the same workaround `seedAppCalendar`/`seedOccurrence` already use for #19 — and exercise
 * everything reachable from there: the identity-edit sheet (this issue's own comment asked
 * whichever of #18/#19/#20 landed first to add the first real colour/emoji-picker sheet coverage),
 * per-calendar enable/disable, and disconnecting.
 */
test.describe('calendar management', () => {
  test('edits the app calendar’s name and emoji through the identity sheet', async ({ page }) => {
    await seedAppCalendar(page, 'Testkalender');

    await page.goto('/settings/calendars');
    await page.getByRole('button', { name: /Testkalender/ }).click();

    const sheet = page.getByRole('dialog', { name: 'Kalender bearbeiten' });
    await expect(sheet).toBeVisible();

    await sheet.getByLabel('Name').fill('Vereinstermine');
    await sheet.getByLabel('Emoji').fill('🌸');
    await sheet.getByRole('button', { name: 'Speichern' }).click();

    await expect(sheet).toBeHidden();
    await expect(page.getByRole('button', { name: /Vereinstermine/ })).toBeVisible();
  });

  test('explains the device-calendar connection before one exists', async ({ page }) => {
    await page.goto('/settings/calendars');

    await expect(page.getByText('Verbinde die Kalender deines Geräts')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Gerätekalender verbinden' })).toBeVisible();
  });

  test('lists a connected device calendar and hides its appointments once disabled', async ({
    page,
  }) => {
    const deviceCalendar = await seedDeviceCalendar(page, 'Familie');
    const { occurrenceId } = await seedOccurrence(page, {
      sourceType: 'device',
      title: 'Familientreffen',
      day: '2026-09-10',
      existingCalendar: deviceCalendar,
    });

    await page.goto('/calendar?day=2026-09-10');
    await expect(page.getByRole('link', { name: /Familientreffen/ })).toBeVisible();

    await page.goto('/settings/calendars');
    const toggle = page.getByRole('switch', { name: 'Familie' });
    await expect(toggle).toBeChecked();
    await toggle.click();
    await expect(toggle).not.toBeChecked();

    await page.goto('/calendar?day=2026-09-10');
    await expect(page.getByRole('link', { name: /Familientreffen/ })).toHaveCount(0);

    // The cached occurrence is only hidden, not gone — its detail is still reachable directly.
    await page.goto(`/calendar/event/${occurrenceId}`);
    await expect(page.getByRole('heading', { name: 'Familientreffen' })).toBeVisible();
  });

  test('disconnects the device calendar after confirming', async ({ page }) => {
    await seedDeviceCalendar(page, 'Familie');

    await page.goto('/settings/calendars');
    await page.getByRole('button', { name: 'Verbindung trennen' }).click();

    const confirmation = page.getByRole('dialog', { name: 'Verbindung trennen?' });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: 'Trennen' }).click();

    await expect(confirmation).toBeHidden();
    await expect(page.getByText('Der Gerätekalender ist getrennt')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Verbinden' })).toBeVisible();
  });
});
