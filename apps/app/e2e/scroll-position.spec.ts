import { test, expect } from '@playwright/test';

type Page = import('@playwright/test').Page;

/**
 * Where a screen is scrolled to after a navigation. Only the shell's `<main>` scrolls, and the
 * browser has no say in it: a unit test can check which offset the shell asks for, but not that it
 * survives the page's content arriving from the database after the first render.
 */
test.describe('scroll position', () => {
  // A phone's viewport, so Heute and the settings are taller than the screen.
  test.use({ viewport: { width: 390, height: 640 } });

  function scrollRegion(page: Page) {
    return page.locator('main');
  }

  async function scrollTo(page: Page, top: number): Promise<number> {
    return scrollRegion(page).evaluate((main, value) => {
      main.scrollTop = value;
      return main.scrollTop;
    }, top);
  }

  function scrollTop(page: Page): Promise<number> {
    return scrollRegion(page).evaluate((main) => main.scrollTop);
  }

  /** Waits until the screen's content has arrived from the database and stopped changing height. */
  async function settled(page: Page): Promise<void> {
    let previous = -1;
    await expect
      .poll(
        async () => {
          const height = await scrollRegion(page).evaluate((main) => main.scrollHeight);
          const stable = height === previous;
          previous = height;
          return stable;
        },
        { intervals: [300] },
      )
      .toBe(true);
  }

  test('returns to Heute where it was left, and opens the next screen at the top', async ({
    page,
  }) => {
    await page.goto('/today');
    const newEvent = page.getByRole('link', { name: 'Neuer Termin' });
    await expect(newEvent).toBeVisible();
    await settled(page);
    // Already in view, so the click below does not scroll to it first.
    await newEvent.scrollIntoViewIfNeeded();
    const left = await scrollTop(page);
    expect(left).toBeGreaterThan(0);

    await newEvent.click();
    await expect(page.getByRole('heading', { name: 'Neuer Termin', level: 1 })).toBeFocused();
    expect(await scrollTop(page)).toBe(0);

    await page.getByRole('button', { name: 'Schließen' }).click();
    await expect(page).toHaveURL(/\/today$/);

    // Held while Heute's content replaces its placeholders, which have a different height.
    await expect.poll(() => scrollTop(page)).toBe(left);
    await page.waitForTimeout(1200);
    expect(await scrollTop(page)).toBe(left);
  });

  test('returns to the settings where they were left', async ({ page }) => {
    await page.goto('/settings');
    await settled(page);
    const about = page.getByRole('link', { name: 'Über die App' });
    // Already in view, so the click below does not scroll to it first.
    await about.scrollIntoViewIfNeeded();
    const left = await scrollTop(page);
    expect(left).toBeGreaterThan(0);

    await about.click();
    await expect(page.getByRole('heading', { name: 'Über die App', level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Zurück' }).click();

    await expect(page).toHaveURL(/\/settings$/);
    await expect.poll(() => scrollTop(page)).toBe(left);
  });

  test('scrolls the month view back up when Kalender is tapped again, staying on the month', async ({
    page,
  }) => {
    await page.goto('/calendar?view=month');
    await expect(page.getByRole('tab', { name: 'Monat' })).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => scrollTo(page, 10_000)).toBeGreaterThan(0);

    await page
      .getByRole('navigation', { name: 'Hauptbereiche' })
      .getByRole('link', { name: 'Kalender' })
      .click();

    await expect.poll(() => scrollTop(page)).toBe(0);
    await expect(page).toHaveURL(/view=month/);
    await expect(page.getByRole('tab', { name: 'Monat' })).toHaveAttribute('aria-selected', 'true');
  });
});
