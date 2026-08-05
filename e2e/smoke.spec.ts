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

  test('offers every approved settings entry', async ({ page }) => {
    await page.goto('/settings');

    for (const [heading, entries] of [
      ['Persönlich', ['Profil']],
      ['Darstellung & Bedienung', ['Farbthema', 'Textgröße', 'Bewegung & Animationen']],
      ['Kalender', ['Kalender verwalten']],
      ['App & Rechtliches', ['Datenschutz', 'Impressum', 'Über die App']],
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
 * The in-app ladder tops out at 2x, Apple's Larger Text floor — but leaving the setting on
 * "Systemeinstellung" keeps the full OS range, and iOS reaches 3.12x. So both sizes are checked.
 *
 * A page that scrolls sideways is the clearest sign that something is pinned to a fixed width or
 * that a long German compound refuses to break: "Systemeinstellung" overflowed a 320px column by
 * 226px at 300% before `hyphens`/`overflow-wrap` were set in src/styles/base.css.
 */
test.describe('large text', () => {
  // Phone widths, not the project's desktop default: at 1280px nothing overflows and the canary
  // would pass while the app scrolls sideways on every real device.
  test.use({ viewport: { width: 375, height: 667 } });

  // The narrowest phone still in use and a common Android size. The narrow one is what a German
  // compound overflows first.
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 412, height: 924 },
  ]) {
    test.describe(`${viewport.width}x${viewport.height}`, () => {
      test.use({ viewport });

      for (const path of [
        '/today',
        '/calendar',
        '/settings',
        '/settings/theme',
        '/settings/text-size',
        '/settings/motion',
      ]) {
        test(`${path} does not scroll horizontally at large text`, async ({ page }) => {
          await page.goto(path);

          for (const size of ['200%', '300%']) {
            await page.evaluate((value) => {
              document.documentElement.style.fontSize = value;
            }, size);

            // Both the document and the shell's scroll region: the content scrolls inside <main>,
            // so an element that refuses to wrap would widen that rather than the document.
            const overflow = await page.evaluate(() => {
              const document_ = document.scrollingElement ?? document.documentElement;
              const region = document.querySelector('main');
              return Math.max(
                document_.scrollWidth - document_.clientWidth,
                region === null ? 0 : region.scrollWidth - region.clientWidth,
              );
            });

            expect(overflow, `${path} at ${size}`).toBeLessThanOrEqual(1);
          }
        });
      }
    });
  }

  /**
   * Vertical scrolling at these sizes is expected — the content genuinely is several viewports tall.
   * What must not happen is the chrome scrolling away with it: the shell is a fixed frame with a
   * single scroll region, so the bottom navigation stays on screen no matter how far the user has
   * scrolled.
   */
  test('keeps the bottom navigation on screen at 200% text', async ({ page }) => {
    await page.goto('/today');
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });

    const navigation = page.getByRole('navigation', { name: 'Hauptbereiche' });
    await expect(navigation).toBeInViewport();

    await page.evaluate(() => {
      document.querySelector('main')?.scrollBy(0, 10_000);
    });

    await expect(navigation).toBeInViewport();
    // The document itself never scrolls; only the region inside the frame does.
    const documentOverflow = await page.evaluate(() => {
      const root = document.scrollingElement ?? document.documentElement;
      return root.scrollHeight - root.clientHeight;
    });
    expect(documentOverflow).toBeLessThanOrEqual(1);
  });

  test('the text size setting changes the root font size', async ({ page }) => {
    await page.goto('/settings/text-size');

    const rootFontSize = () =>
      page.evaluate(() => getComputedStyle(document.documentElement).fontSize);

    // No attribute yet: the OS scale applies, which is the neutral 1 on the web.
    await expect(page.locator('html')).not.toHaveAttribute('data-text-size');
    expect(await rootFontSize()).toBe('16px');

    await page.getByRole('radio', { name: 'Riesig' }).check();

    await expect(page.locator('html')).toHaveAttribute('data-text-size', 'xxlarge');
    expect(await rootFontSize()).toBe('32px');

    await page.reload();

    expect(await rootFontSize()).toBe('32px');
  });
});
