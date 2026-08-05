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
 * The „Nicht vergessen“ list is the first feature with a database behind it, so this is also where
 * the SQLite setup is verified end to end: on the web it runs through `jeep-sqlite` and IndexedDB,
 * which a unit test cannot reach. Every test starts with an empty database, because Playwright gives
 * each one its own browser context — so entries are always created through the UI.
 */
test.describe('the „Nicht vergessen“ list', () => {
  /**
   * Locators are scoped to the row rather than to the whole page: the entry's text also appears in
   * the accessible names of its own controls, so a page-wide text match is ambiguous by design.
   */
  function row(page: Page, text: string) {
    return page.getByRole('listitem').filter({ hasText: text });
  }

  async function addReminder(page: Page, text: string) {
    const field = page.getByLabel('Neue Erinnerung');
    if (!(await field.isVisible())) {
      await page.getByRole('button', { name: 'Punkt hinzufügen' }).click();
    }

    await field.fill(text);
    await page.getByRole('button', { name: 'Hinzufügen' }).click();
    await expect(row(page, text)).toBeVisible();
  }

  /** Opens a row's menu and picks one of its two actions. */
  async function chooseAction(page: Page, text: string, action: 'Bearbeiten' | 'Löschen') {
    await row(page, text)
      .getByRole('button', { name: `Optionen für „${text}“` })
      .click();
    await row(page, text).getByRole('menuitem', { name: action }).click();
  }

  test('invites the first entry while the list is empty', async ({ page }) => {
    await page.goto('/today');

    await expect(page.getByText('Hier ist noch nichts.')).toBeVisible();
  });

  test('keeps an entry and its completion state after a reload', async ({ page }) => {
    await page.goto('/today');
    await addReminder(page, 'Blumen gießen');

    const toggle = row(page, 'Blumen gießen').getByRole('checkbox');
    await expect(toggle).toHaveAttribute('aria-label', '„Blumen gießen“ als erledigt markieren');
    await toggle.check();

    // The label now offers the opposite action, which is how the state is readable without colour.
    await expect(toggle).toHaveAttribute(
      'aria-label',
      '„Blumen gießen“ wieder als offen markieren',
    );

    await page.reload();

    const afterReload = row(page, 'Blumen gießen').getByRole('checkbox');
    await expect(afterReload).toBeChecked();
    await expect(afterReload).toHaveAttribute(
      'aria-label',
      '„Blumen gießen“ wieder als offen markieren',
    );
  });

  test('reopens a completed entry', async ({ page }) => {
    await page.goto('/today');
    await addReminder(page, 'Post holen');

    const toggle = row(page, 'Post holen').getByRole('checkbox');
    await toggle.check();
    await toggle.uncheck();

    await expect(toggle).not.toBeChecked();
    await expect(toggle).toHaveAttribute('aria-label', '„Post holen“ als erledigt markieren');
  });

  test('applies an edit and discards a cancelled one', async ({ page }) => {
    await page.goto('/today');
    await addReminder(page, 'Blumen gießen');

    await chooseAction(page, 'Blumen gießen', 'Bearbeiten');
    await page.getByLabel('Text der Erinnerung').fill('Blumen gießen und lüften');
    await page.getByRole('button', { name: 'Speichern' }).click();

    await expect(row(page, 'Blumen gießen und lüften')).toBeVisible();

    await chooseAction(page, 'Blumen gießen und lüften', 'Bearbeiten');
    await page.getByLabel('Text der Erinnerung').fill('Etwas anderes');
    // Scoped to the sheet: the add row's cancel control is also named "… abbrechen".
    await page
      .getByRole('dialog', { name: 'Erinnerung bearbeiten' })
      .getByRole('button', { name: 'Abbrechen', exact: true })
      .click();

    await expect(row(page, 'Blumen gießen und lüften')).toBeVisible();
    await expect(row(page, 'Etwas anderes')).toHaveCount(0);
  });

  test('deletes an entry only after the confirmation is accepted', async ({ page }) => {
    await page.goto('/today');
    await addReminder(page, 'Blumen gießen');

    await chooseAction(page, 'Blumen gießen', 'Löschen');
    const confirmation = page.getByRole('dialog', { name: 'Erinnerung löschen?' });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: 'Abbrechen' }).click();

    await expect(row(page, 'Blumen gießen')).toBeVisible();

    await chooseAction(page, 'Blumen gießen', 'Löschen');
    await page.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click();

    await expect(page.getByText('Hier ist noch nichts.')).toBeVisible();
  });

  /**
   * Below 16px, iOS zooms the page in when a field takes focus and never zooms back out, leaving the
   * app magnified and scrolling in both directions. The smallest in-app text size is 14px, so this is
   * the case that would regress first. Chromium does not zoom, but the threshold is a number.
   */
  test('never renders a text field below the size that makes iOS zoom', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('rk.appearance', JSON.stringify({ textSize: 'small' }));
    });
    await page.goto('/today');
    await expect(page.locator('html')).toHaveAttribute('data-text-size', 'small');

    await page.getByRole('button', { name: 'Punkt hinzufügen' }).click();

    const fontSize = await page
      .getByLabel('Neue Erinnerung')
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(16);
  });

  test('reaches both row actions from the keyboard', async ({ page }) => {
    await page.goto('/today');
    await addReminder(page, 'Blumen gießen');

    const trigger = row(page, 'Blumen gießen').getByRole('button', {
      name: 'Optionen für „Blumen gießen“',
    });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await trigger.focus();
    await page.keyboard.press('Enter');

    // Opening the menu moves focus to its first item; the arrow key then walks the two items.
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('menuitem', { name: 'Bearbeiten' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'Löschen' })).toBeFocused();

    await page.keyboard.press('Escape');

    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('menuitem', { name: 'Löschen' })).toBeHidden();
  });

  test('has no serious or critical accessibility violations with entries or an open sheet', async ({
    page,
  }) => {
    await page.goto('/today');
    await addReminder(page, 'Blumen gießen');
    await row(page, 'Blumen gießen').getByRole('checkbox').check();

    await expectNoBlockingViolations(page);

    await row(page, 'Blumen gießen')
      .getByRole('button', { name: 'Optionen für „Blumen gießen“' })
      .click();
    await expect(page.getByRole('menuitem', { name: 'Löschen' })).toBeVisible();

    await expectNoBlockingViolations(page);

    await page.getByRole('menuitem', { name: 'Bearbeiten' }).click();
    await expect(page.getByRole('dialog', { name: 'Erinnerung bearbeiten' })).toBeVisible();

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
   * The loop above renders Today with an empty list, so the row layout itself is never under test —
   * and a row is where user-entered text meets two icon buttons. The narrowest viewport plus a German
   * compound nobody would type but everybody has seen is exactly the case the row has to survive.
   */
  test.describe('320x568 with an entry', () => {
    test.use({ viewport: { width: 320, height: 568 } });

    test('a long entry does not make Today scroll sideways at large text', async ({ page }) => {
      await page.goto('/today');
      await page.getByRole('button', { name: 'Punkt hinzufügen' }).click();
      await page.getByLabel('Neue Erinnerung').fill('Donaudampfschifffahrtsgesellschaftskapitän');
      await page.getByRole('button', { name: 'Hinzufügen' }).click();
      await expect(page.locator('ul.rk-list > li')).toHaveCount(1);

      for (const size of ['200%', '300%']) {
        await page.evaluate((value) => {
          document.documentElement.style.fontSize = value;
        }, size);

        const overflow = await page.evaluate(() => {
          const document_ = document.scrollingElement ?? document.documentElement;
          const region = document.querySelector('main');
          return Math.max(
            document_.scrollWidth - document_.clientWidth,
            region === null ? 0 : region.scrollWidth - region.clientWidth,
          );
        });

        expect(overflow, `a long entry at ${size}`).toBeLessThanOrEqual(1);
      }
    });
  });

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
