import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('application shell', () => {
  test('renders the application name', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Rebell*innen Kalender' })).toBeVisible();
  });

  test('has no serious or critical accessibility violations', async ({ page }) => {
    await page.goto('/');

    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    );

    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });
});
