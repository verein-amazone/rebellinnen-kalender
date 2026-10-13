import { test, expect, type Page } from '@playwright/test';
import { expectNoBlockingViolations } from './support/a11y';

/**
 * The Inhalte search end to end: the real catalogs, reconciled into SQLite's wasm build, searched
 * through the FTS5 trigram index. A unit spec runs the same SQL on `node:sqlite`, but only here does
 * the browser's own engine answer it.
 */
test.describe('searching Inhalte', () => {
  async function bookmark(page: Page, id: string, title: string): Promise<void> {
    await page.goto(`/content/${id}`);
    await page.getByRole('button', { name: `Zu „Meine Sammlung“ hinzufügen: ${title}` }).click();
    await expect(
      page.getByRole('button', { name: `Aus „Meine Sammlung“ entfernen: ${title}` }),
    ).toBeVisible();
  }

  async function search(page: Page, area: string, query: string): Promise<void> {
    await page.getByRole('button', { name: `In ${area} suchen` }).click();
    const field = page.getByRole('searchbox', { name: `In ${area} suchen` });
    await expect(field).toBeFocused();
    await field.fill(query);
  }

  test('finds a saved item by part of a word, and keeps the search on the way back', async ({
    page,
  }) => {
    await bookmark(page, 'reb-01', 'Hedy Lamarr');
    await bookmark(page, 'reb-02', 'Christina Koch');
    await page.goto('/content');

    await search(page, 'Meine Sammlung', 'lamar');

    await expect(page.getByRole('status')).toHaveText('1 Treffer');
    await expect(page.getByRole('link', { name: /Hedy Lamarr/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Christina Koch/ })).toBeHidden();
    await expectNoBlockingViolations(page);

    await page.getByRole('link', { name: /Hedy Lamarr/ }).click();
    await page.getByRole('button', { name: 'Zurück' }).click();

    await expect(page.getByRole('searchbox', { name: 'In Meine Sammlung suchen' })).toHaveValue(
      'lamar',
    );
    await expect(page.getByRole('link', { name: /Christina Koch/ })).toBeHidden();
  });

  test('finds Anlaufstellen across every region, inside compound words', async ({ page }) => {
    await page.goto('/content?area=services');

    await search(page, 'Anlaufstellen', 'beratung tirol');

    await expect(page.getByRole('status')).toHaveText(/\d+ Treffer/);
    await expect(page.getByRole('radio')).toHaveCount(0);
    await expect(
      page.getByText('Frauenzentrum Osttirol - Beratung für Mädchen und Frauen'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Suche schließen' }).click();
    await expect(page.getByRole('button', { name: 'In Anlaufstellen suchen' })).toBeFocused();
    await expect(page.getByRole('radio').first()).toBeVisible();
  });

  test('says when nothing matches', async ({ page }) => {
    await page.goto('/content?area=services');

    await search(page, 'Anlaufstellen', 'xylophon');

    await expect(page.getByRole('status')).toHaveText('Keine Treffer für „xylophon“');
    await expect(page.getByText('Prüfe die Schreibweise')).toBeVisible();
  });
});
