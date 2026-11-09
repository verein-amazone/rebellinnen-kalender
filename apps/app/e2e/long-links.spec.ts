import { test, expect, type Locator } from '@playwright/test';
import { seedOccurrence } from './support/calendar-seed';

/**
 * Console and store links are longer than a phone line, with nowhere to break but their slashes.
 * Hyphenating one to make it fit changes the address it shows, and in WebKit the inherited
 * `hyphens: auto` also left a segment of such a URL unbroken: it ran past the card and the whole
 * event detail screen panned sideways. So links in rendered rich text wrap without hyphens.
 *
 * The overflow itself only reproduced in WebKit, which this suite does not run; the hyphenation
 * check is what fails in Chromium when the rule is missing.
 */
test.describe('long links', () => {
  // An iPhone's width, where the reported URLs overflowed.
  test.use({ viewport: { width: 390, height: 844 } });

  async function expectNoAutoHyphens(links: Locator): Promise<void> {
    for (const link of await links.all()) {
      expect(await link.evaluate((element) => getComputedStyle(element).hyphens)).toMatch(
        /^(manual|none)$/,
      );
    }
  }

  test('wrap inside the event card, without hyphens', async ({ page }) => {
    const { occurrenceId } = await seedOccurrence(page, {
      sourceType: 'device',
      calendarWritable: true,
      title: 'App-Release',
      day: '2026-09-04',
      description: [
        'Release prüfen:',
        'https://play.google.com/console/u/0/developers/8916889074067739121/app/4973469646249649485/publishing',
        'https://appstoreconnect.apple.com/apps/6806218483/distribution/ios/version/inflight',
      ].join('\n'),
    });

    await page.goto(`/calendar/event/${encodeURIComponent(occurrenceId)}`);
    const card = page.locator('section.rk-card');
    const links = card.locator('app-event-description a');
    await expect(links).toHaveCount(2);

    // Both the document and the shell's scroll region, as in `large-text.spec.ts`: the content
    // scrolls inside <main>, so a link that refuses to wrap widens that rather than the document.
    const overflow = await page.evaluate(() => {
      const document_ = document.scrollingElement ?? document.documentElement;
      const region = document.querySelector('main');
      return Math.max(
        document_.scrollWidth - document_.clientWidth,
        region === null ? 0 : region.scrollWidth - region.clientWidth,
      );
    });
    expect(overflow).toBeLessThanOrEqual(1);

    const cardBox = await card.boundingBox();
    expect(cardBox).not.toBeNull();
    const cardRight = cardBox!.x + cardBox!.width;
    expect(cardRight).toBeLessThanOrEqual(390);
    for (const link of await links.all()) {
      const linkBox = await link.boundingBox();
      expect(linkBox!.x + linkBox!.width).toBeLessThanOrEqual(cardRight);
    }
    await expectNoAutoHyphens(links);
  });

  test('in the legal texts wrap without hyphens', async ({ page }) => {
    await page.goto('/settings/privacy');
    const links = page.locator('.rk-markdown-content a');
    await expect(links.first()).toBeVisible();
    await expectNoAutoHyphens(links);
  });
});
