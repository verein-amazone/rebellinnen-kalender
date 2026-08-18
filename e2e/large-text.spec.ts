import { test, expect } from '@playwright/test';
import { seedAppCalendar, seedOccurrence } from './support/calendar-seed';

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
        '/calendar?view=month',
        '/settings',
        '/settings/theme',
        '/settings/text-size',
        '/settings/motion',
        '/settings/reminders',
        '/settings/calendars',
        '/calendar/event/new',
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
   * The loop above never opens an appointment (there is nothing to open until one is seeded — see
   * `e2e/support/calendar-seed.ts`), so its detail read view, its in-place edit view, and the two
   * sheets calendar delete/edit can now open (`ConfirmationDialog`, `RecurrenceScopeDialog`) are
   * otherwise untested at large text. A long title is what exercises row/heading wrapping, the same
   * reasoning as the reminder entry above.
   */
  test.describe('320x568 with an appointment', () => {
    test.use({ viewport: { width: 320, height: 568 } });

    test('appointment screens and sheets do not scroll sideways at large text', async ({
      page,
    }) => {
      const longTitle = 'Donaudampfschifffahrtsgesellschaftskapitänsversammlung';

      const { occurrenceId } = await seedOccurrence(page, {
        sourceType: 'app',
        title: longTitle,
        day: '2026-09-14',
        recurring: true,
      });

      const checkNoOverflow = async (label: string) => {
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

          expect(overflow, `${label} at ${size}`).toBeLessThanOrEqual(1);
        }
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '';
        });
      };

      await page.goto(`/calendar/event/${occurrenceId}`);
      await expect(page.getByRole('heading', { name: longTitle })).toBeVisible();
      await checkNoOverflow('detail read view');

      await page.getByRole('button', { name: 'Bearbeiten' }).click();
      await checkNoOverflow('detail edit view');

      // No "Abbrechen" button any more — the header back-arrow cancels edit mode (see
      // `EventDetailPage.handleBeforeDismiss`).
      await page.getByRole('button', { name: 'Zurück' }).click();
      await page.getByRole('button', { name: 'Löschen' }).click();
      await expect(page.getByRole('dialog', { name: 'Termin löschen?' })).toBeVisible();
      await checkNoOverflow('the delete confirmation sheet');

      await page
        .getByRole('dialog', { name: 'Termin löschen?' })
        .getByRole('button', { name: 'Löschen' })
        .click();
      await expect(page.getByRole('dialog', { name: 'Was möchtest du löschen?' })).toBeVisible();
      await checkNoOverflow('the recurrence scope sheet');
    });
  });

  test.describe('320x568 with a new-appointment form', () => {
    test.use({ viewport: { width: 320, height: 568 } });

    test('the calendar picker does not scroll sideways at large text with a long calendar name', async ({
      page,
    }) => {
      await seedAppCalendar(page, 'Donaudampfschifffahrtsgesellschaftskapitänsverein');
      await page.goto('/calendar/event/new');

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

        expect(overflow, `a long calendar name at ${size}`).toBeLessThanOrEqual(1);
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

    // The document itself never scrolls; only the region inside the frame does. Read before any
    // geometry query (`boundingBox`/`toBeInViewport`/`getBoundingClientRect`) touches the page: for
    // content several viewports tall, each of those forces a layout pass that leaves Chromium's own
    // `documentElement.scrollHeight` stale on every read afterwards — confirmed by hand against this
    // exact page, not a real overflow. Reading it first, in the same `evaluate` as the scroll,
    // sidesteps that entirely.
    const documentOverflow = await page.evaluate(() => {
      document.querySelector('main')?.scrollBy(0, 10_000);
      const root = document.scrollingElement ?? document.documentElement;
      return root.scrollHeight - root.clientHeight;
    });
    expect(documentOverflow).toBeLessThanOrEqual(1);

    const navigation = page.getByRole('navigation', { name: 'Hauptbereiche' });
    await expect(navigation).toBeInViewport();
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

    // The attribute is restored asynchronously from the database after the reload; wait for it
    // before reading the computed style, which does not retry.
    await expect(page.locator('html')).toHaveAttribute('data-text-size', 'xxlarge');
    expect(await rootFontSize()).toBe('32px');
  });
});
