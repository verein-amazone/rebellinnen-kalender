import { test, expect } from '@playwright/test';
import { expectNoBlockingViolations } from './support/a11y';
import { developerToolsEnabled } from './support/developer-tools';

/**
 * The first-launch introduction (#82). The shared config marks it as seen for every other spec;
 * these start from a really fresh install instead.
 */
test.describe('first-launch introduction', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('opens on the first launch and walks through every step', async ({ page }) => {
    // The theme picked on the way recolours with a transition; axe must see the settled colours.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    await expect(page).toHaveURL(/\/intro\/1/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Schön, dass du da bist!' }),
    ).toBeFocused();
    await expectNoBlockingViolations(page);

    await page.getByRole('button', { name: 'Weiter' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Was kann die App?' })).toBeFocused();
    // Skipping is offered on the first step only; later steps are just „Weiter“ and „Zurück“.
    await expect(page.getByRole('button', { name: 'Erste Schritte überspringen' })).toHaveCount(0);
    await expectNoBlockingViolations(page);

    await page.getByRole('button', { name: 'Zurück' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Schön, dass du da bist!' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Weiter' }).click();
    await page.getByRole('button', { name: 'Weiter' }).click();

    await expect(
      page.getByRole('heading', { level: 1, name: 'Mach die App zu deiner' }),
    ).toBeFocused();
    await page.getByLabel('Dein Name').fill('Alex');
    await page.getByRole('radio', { name: 'Mitternacht' }).check();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'nacht');
    await expectNoBlockingViolations(page);
    await page.getByRole('button', { name: 'Weiter' }).click();

    await expect(
      page.getByRole('heading', { level: 1, name: 'Deine Daten bleiben bei dir' }),
    ).toBeFocused();
    await expectNoBlockingViolations(page);
    await page.getByRole('button', { name: 'Los geht’s' }).click();

    await expect(page).toHaveURL(/\/today/);
    await expect(page.getByText('Alex')).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/\/today/);
  });

  test('can be skipped and stays skipped', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Erste Schritte überspringen' }).click();

    await expect(page).toHaveURL(/\/today/);
    await page.goto('/');
    await expect(page).toHaveURL(/\/today/);
  });

  test('never diverts a deep link', async ({ page }) => {
    await page.goto('/settings/about');

    await expect(page).toHaveURL(/\/settings\/about/);
  });

  test('can be reopened from the settings and returns there', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Erste Schritte überspringen' }).click();
    await expect(page).toHaveURL(/\/today/);

    await page.goto('/settings');
    await page.getByRole('link', { name: 'Einführung ansehen' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Schön, dass du da bist!' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Erste Schritte überspringen' }).click();
    await expect(page).toHaveURL(/\/settings$/);
  });

  test('continues where it was left off after the app was closed', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Weiter' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Was kann die App?' })).toBeFocused();

    // A relaunch lands on Heute, like the app does.
    await page.goto('/today');

    await expect(page).toHaveURL(/\/intro\/2/);
    await expect(page.getByRole('heading', { level: 1, name: 'Was kann die App?' })).toBeVisible();
  });

  test('starts over from the first step after a reset in the developer tools', async ({ page }) => {
    test.skip(!developerToolsEnabled, 'A stable build has no developer tools.');
    await page.goto('/');
    await page.getByRole('button', { name: 'Weiter' }).click();
    await page.getByRole('button', { name: 'Weiter' }).click();
    await page.getByRole('button', { name: 'Weiter' }).click();
    await page.getByRole('button', { name: 'Los geht’s' }).click();
    await expect(page).toHaveURL(/\/today/);

    await page.goto('/settings/dev-tools');
    await page.getByRole('button', { name: 'Einführung zurücksetzen' }).click();

    await expect(page).toHaveURL(/\/intro\/1/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Schön, dass du da bist!' }),
    ).toBeFocused();
  });
});
