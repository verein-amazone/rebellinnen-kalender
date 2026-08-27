import { test, expect } from '@playwright/test';
import { expectNoBlockingViolations } from './support/a11y';

type Page = import('@playwright/test').Page;

/**
 * The „Nicht vergessen“ list is the first feature with a database behind it, so this is also where
 * the SQLite setup is verified end to end: on the web it runs through `jeep-sqlite` and IndexedDB,
 * which a unit test cannot reach. Every test starts with an empty database, because Playwright gives
 * each one its own browser context - so entries are always created through the UI.
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
    await page.getByRole('button', { name: 'Punkt hinzufügen' }).click();

    const dialog = page.getByRole('dialog', { name: 'Neue Erinnerung' });
    await dialog.getByLabel('Text der Erinnerung').fill(text);
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(row(page, text)).toBeVisible();
  }

  /** Opens a row's menu and picks one of its actions. */
  async function chooseAction(
    page: Page,
    text: string,
    action: 'Nach oben' | 'Nach unten' | 'Bearbeiten' | 'Löschen',
  ) {
    await row(page, text)
      .getByRole('button', { name: `Optionen für „${text}“` })
      .click();
    await row(page, text).getByRole('menuitem', { name: action }).click();
  }

  /**
   * The entry texts in the order they are shown - one list, open entries first. The label span rather
   * than the row: the entry's text also sits in the accessible names of the row's own controls.
   */
  function texts(page: Page) {
    return page.locator('app-reminder-list li label > span').allInnerTexts();
  }

  /**
   * Ticks an entry off and waits until the list has caught up. Completing reloads the list, and a
   * second tick issued before that lands on a row that is being re-rendered.
   */
  async function complete(page: Page, text: string) {
    await row(page, text).getByRole('checkbox').check();
    // The label offers the opposite action once the write has come back.
    await expect(row(page, text).getByRole('checkbox')).toHaveAttribute(
      'aria-label',
      `„${text}“ wieder als offen markieren`,
    );
  }

  /**
   * Every write reloads the list from the database, so the new order arrives a tick after the click.
   * Polling is what makes that a wait rather than a race.
   */
  function expectOrder(page: Page, expected: readonly string[]) {
    return expect.poll(() => texts(page)).toEqual([...expected]);
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

  test('puts a new entry at the top of the open ones', async ({ page }) => {
    await page.goto('/today');
    await addReminder(page, 'Zuerst');
    await addReminder(page, 'Danach');

    await expectOrder(page, ['Danach', 'Zuerst']);
  });

  test('moves a completed entry to the top of the completed ones', async ({ page }) => {
    await page.goto('/today');
    await addReminder(page, 'Erster');
    await addReminder(page, 'Zweiter');
    await addReminder(page, 'Dritter');

    // The oldest entry, so completion order rather than age has to decide where it lands.
    await complete(page, 'Erster');
    await complete(page, 'Zweiter');

    await expectOrder(page, ['Dritter', 'Zweiter', 'Erster']);
  });

  test('keeps a hand-made order after a reload', async ({ page }) => {
    await page.goto('/today');
    await addReminder(page, 'Eins');
    await addReminder(page, 'Zwei');
    await addReminder(page, 'Drei');

    await expectOrder(page, ['Drei', 'Zwei', 'Eins']);

    await chooseAction(page, 'Eins', 'Nach oben');
    await expectOrder(page, ['Drei', 'Eins', 'Zwei']);

    // This is what proves the position survives the round trip through jeep-sqlite and IndexedDB.
    await page.reload();

    await expectOrder(page, ['Drei', 'Eins', 'Zwei']);
  });

  /**
   * A regression guard with a specific history: `cdkDrag` puts a `transform` on every row, which makes
   * the row its own stacking context, and the menu panel ended up painted underneath the row below -
   * which then swallowed the tap. The failure looked like the entry jumping to the other section.
   */
  test('reorders inside the completed section without leaving it', async ({ page }) => {
    await page.goto('/today');
    await addReminder(page, 'Eins');
    await addReminder(page, 'Zwei');
    await addReminder(page, 'Drei');

    await complete(page, 'Eins');
    await complete(page, 'Zwei');
    await expectOrder(page, ['Drei', 'Zwei', 'Eins']);

    await chooseAction(page, 'Zwei', 'Nach unten');

    await expectOrder(page, ['Drei', 'Eins', 'Zwei']);
    // Moving must not change what the entry is, only where it sits.
    await expect(row(page, 'Zwei').getByRole('checkbox')).toBeChecked();
  });

  /**
   * The other half of that history: rendering the rows through an `ng-template` made Angular treat a
   * reordered row as removed and re-created, so a leave animation ran on a row that was staying and
   * left it at `opacity: 0`. The animations are gone now, and the row still has to survive the move
   * fully visible - which is what would break again if a row stopped being moved and started being
   * re-created.
   */
  test('keeps a reordered row fully visible', async ({ page }) => {
    await page.goto('/today');
    await addReminder(page, 'Eins');
    await addReminder(page, 'Zwei');
    await addReminder(page, 'Drei');
    await complete(page, 'Eins');

    await chooseAction(page, 'Drei', 'Nach unten');

    await expectOrder(page, ['Zwei', 'Drei', 'Eins']);
    for (const text of ['Zwei', 'Drei']) {
      await expect(row(page, text)).toHaveCSS('opacity', '1');
    }
  });

  /**
   * Desktop Chromium is not a finger, so this proves the wiring rather than the gesture: that the rows
   * really belong to the drop list above them, and that a drop is written and read back. Everything
   * about how the drag *feels* is still a manual check on a device.
   */
  test('reorders by dragging a row onto another, and keeps it after a reload', async ({ page }) => {
    await page.goto('/today');
    await addReminder(page, 'Eins');
    await addReminder(page, 'Zwei');
    await addReminder(page, 'Drei');
    await expectOrder(page, ['Drei', 'Zwei', 'Eins']);

    const handle = row(page, 'Drei').locator('[cdkDragHandle]');
    const target = row(page, 'Eins');
    const from = (await handle.boundingBox())!;
    const to = (await target.boundingBox())!;

    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    // In steps: the CDK starts a drag from movement, not from the button going down.
    for (let step = 1; step <= 10; step += 1) {
      await page.mouse.move(
        from.x + from.width / 2,
        from.y + from.height / 2 + ((to.y - from.y) * step) / 10,
        { steps: 2 },
      );
    }
    await expect(page.locator('.cdk-drag-preview')).toHaveCount(1);
    await page.mouse.up();

    await expectOrder(page, ['Zwei', 'Eins', 'Drei']);

    await page.reload();

    await expectOrder(page, ['Zwei', 'Eins', 'Drei']);
  });

  /**
   * The gap left behind has to be exactly as tall as the row that left it, or the rest of the list
   * jumps the moment a drag starts. A deliberately long entry wraps onto several lines, which is where
   * a hand-written placeholder of a fixed height gets it wrong.
   */
  test('leaves a gap the size of the row, so nothing shifts while dragging', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/today');
    await addReminder(
      page,
      'Ein sehr langer Punkt, der über mehrere Zeilen läuft und deshalb höher ist als eine normale Zeile',
    );
    await addReminder(page, 'Kurz');

    const list = page.locator('app-reminder-list ul');
    const dragged = row(page, 'Ein sehr langer Punkt');
    const heightBefore = (await dragged.boundingBox())!.height;
    const listBefore = (await list.boundingBox())!.height;

    // Guards the test itself: a placeholder of a fixed row height only gets this wrong when the row
    // it replaces is taller than one line.
    const shortHeight = (await row(page, 'Kurz').boundingBox())!.height;
    expect(heightBefore).toBeGreaterThan(shortHeight + 8);

    const handle = dragged.locator('[cdkDragHandle]');
    const from = (await handle.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    for (let step = 1; step <= 6; step += 1) {
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + step * 6, {
        steps: 2,
      });
    }

    const placeholder = page.locator('.cdk-drag-placeholder');
    await expect(placeholder).toHaveCount(1);
    const gap = (await placeholder.boundingBox())!.height;
    const listDuring = (await list.boundingBox())!.height;

    await page.mouse.up();

    expect(gap).toBeCloseTo(heightBefore, 0);
    expect(listDuring).toBeCloseTo(listBefore, 0);
  });

  /**
   * With one list there is no structural barrier between the open and the completed entries, so the
   * sort predicate is the only thing keeping a drag from doing what only the checkbox may do.
   */
  test('cannot drag a completed entry back among the open ones', async ({ page }) => {
    await page.goto('/today');
    await addReminder(page, 'Offen A');
    await addReminder(page, 'Offen B');
    await addReminder(page, 'Erledigt');
    await complete(page, 'Erledigt');
    await expectOrder(page, ['Offen B', 'Offen A', 'Erledigt']);

    const handle = row(page, 'Erledigt').locator('[cdkDragHandle]');
    const target = row(page, 'Offen B');
    const from = (await handle.boundingBox())!;
    const to = (await target.boundingBox())!;

    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    for (let step = 1; step <= 10; step += 1) {
      await page.mouse.move(
        from.x + from.width / 2,
        from.y + from.height / 2 - ((from.y - to.y) * step) / 10,
        { steps: 2 },
      );
    }
    await page.mouse.up();

    await expectOrder(page, ['Offen B', 'Offen A', 'Erledigt']);
    await expect(row(page, 'Erledigt').getByRole('checkbox')).toBeChecked();
  });

  test('offers no move where it would do nothing', async ({ page }) => {
    await page.goto('/today');
    await addReminder(page, 'Oben');
    await addReminder(page, 'Unten');

    // Wait for the reload the second entry triggered: a click on a row that is about to be replaced
    // lands on a node that no longer exists by the time the menu would open.
    await expectOrder(page, ['Unten', 'Oben']);

    const trigger = row(page, 'Unten').getByRole('button', { name: 'Optionen für „Unten“' });
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await expect(row(page, 'Unten').getByRole('menuitem', { name: 'Nach unten' })).toBeVisible();
    await expect(row(page, 'Unten').getByRole('menuitem', { name: 'Nach oben' })).toHaveCount(0);
  });

  test('adds at the end once the setting says so', async ({ page }) => {
    await page.goto('/settings/reminders');
    await page.getByRole('radio', { name: 'Unten' }).first().check();

    await page.goto('/today');
    await addReminder(page, 'Zuerst');
    await addReminder(page, 'Danach');

    await expectOrder(page, ['Zuerst', 'Danach']);
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
      .getByRole('dialog', { name: 'Neue Erinnerung' })
      .getByLabel('Text der Erinnerung')
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(16);
  });

  test('closes a row menu again when something else is tapped', async ({ page }) => {
    await page.goto('/today');
    await addReminder(page, 'Blumen gießen');

    await row(page, 'Blumen gießen')
      .getByRole('button', { name: 'Optionen für „Blumen gießen“' })
      .click();
    await expect(page.getByRole('menuitem', { name: 'Löschen' })).toBeVisible();

    // The only dismissal a finger has: there is no pointer to move away, and no Escape key.
    // The reminder list's own heading - the page `<h1>` is visually hidden and cannot take a tap.
    await page.getByRole('heading', { name: 'Nicht vergessen' }).click();

    await expect(page.getByRole('menuitem', { name: 'Löschen' })).toHaveCount(0);
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
    const first = page.getByRole('menuitem', { name: 'Bearbeiten' });
    await expect(first).toBeFocused();
    // `data-active` is the directive's own marker for the item its key manager is on.
    await expect(first).toHaveAttribute('data-active', 'true');

    // Pressed on the item rather than on the page: `keyboard.press` sends the key wherever focus
    // happens to be at that instant, and a keystroke that arrives a tick after a re-render lands on
    // <body> and is simply lost.
    await first.press('ArrowDown');
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
