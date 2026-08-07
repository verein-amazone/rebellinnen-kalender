import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

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
      await page.getByLabel('Neue Erinnerung').fill('Blumen gießen');
      await page.getByRole('button', { name: 'Hinzufügen' }).click();
      await page.getByRole('button', { name: 'Optionen für „Blumen gießen“' }).click();
      await expect(page.getByRole('menuitem', { name: 'Löschen' })).toBeVisible();

      const menuResults = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
      expect(menuResults.violations, JSON.stringify(menuResults.violations, null, 2)).toEqual([]);

      await page.getByRole('menuitem', { name: 'Bearbeiten' }).click();
      await expect(page.getByRole('dialog', { name: 'Erinnerung bearbeiten' })).toBeVisible();

      const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();

      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
    });
  }
});
