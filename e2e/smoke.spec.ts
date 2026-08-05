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

async function expectNoBlockingViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );

  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
}

test.describe('application shell', () => {
  test('starts on the Today page', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/today$/);
    await expect(page.getByRole('heading', { name: 'Heute', level: 1 })).toBeVisible();
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

    await expect(page).toHaveURL(/\/calendar\/event\/new$/);
    await expect(page.getByRole('navigation', { name: 'Hauptbereiche' })).toBeHidden();
    // Creation screens dismiss with "Schließen", not "Zurück".
    await expect(page.getByRole('heading', { name: 'Neuer Termin', level: 1 })).toBeFocused();

    await page.getByRole('button', { name: 'Schließen' }).click();

    await expect(page).toHaveURL(/\/calendar$/);
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
});

/**
 * Every theme is a separate palette, so contrast has to be checked per theme rather than once. The
 * status colours added with the design system multiply the number of pairs, and this is what keeps
 * that from drifting silently.
 */
test.describe('colour contrast per theme', () => {
  for (const theme of THEMES) {
    for (const path of ['/today', '/settings']) {
      test(`${theme} has sufficient contrast on ${path}`, async ({ page }) => {
        await selectTheme(page, theme);
        await page.goto(path);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

        const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();

        expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
      });
    }
  }
});

/**
 * The design system's primitives are built to survive a much larger root font size than the app
 * currently offers, because the OS text-size preference will drive it later. A page that scrolls
 * sideways is the clearest sign that something is pinned to a fixed width or refusing to wrap.
 */
test.describe('large text', () => {
  for (const path of ['/today', '/calendar', '/settings', '/settings/theme']) {
    test(`${path} does not scroll horizontally at 200% text`, async ({ page }) => {
      await page.goto(path);
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%';
      });

      const overflow = await page.evaluate(() => {
        const root = document.scrollingElement ?? document.documentElement;
        return root.scrollWidth - root.clientWidth;
      });

      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});
