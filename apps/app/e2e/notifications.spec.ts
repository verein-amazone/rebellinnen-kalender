import { test, expect } from '@playwright/test';
import { expectNoBlockingViolations } from './support/a11y';

/**
 * Appointment reminders (#81) on the web build. A browser cannot deliver a reminder while the page
 * is closed, so the settings explain that instead of offering a switch, and the appointment form
 * has no reminder section. Scheduling itself is covered by the unit specs and checked on a device.
 */
test.describe('appointment reminders on the web', () => {
  test('the settings explain that reminders need the app', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('link', { name: /Benachrichtigungen/ })).toContainText(
      'Nur in der App',
    );

    await page.getByRole('link', { name: /Benachrichtigungen/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Benachrichtigungen' })).toBeVisible();
    await expect(page.getByText('Erinnerungen an Termine gibt es nur in der App')).toBeVisible();
    await expect(page.getByRole('switch')).toHaveCount(0);
    await expectNoBlockingViolations(page);
  });

  test('the appointment form offers no reminders', async ({ page }) => {
    await page.goto('/calendar/event/new?day=2026-08-10');

    await expect(page.getByText('Erinnerung hinzufügen')).toHaveCount(0);
  });
});
