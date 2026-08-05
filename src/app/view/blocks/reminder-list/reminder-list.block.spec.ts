import { TestBed } from '@angular/core/testing';
import { of, type Observable } from 'rxjs';

import { ReminderListInteractor } from '@app/interactors/reminders/reminder-list.interactor';
import type { Reminder } from '@app/interactors/reminders/reminder.vm';
import { SheetService } from '@app/view/components/sheet/sheet.service';

import { ReminderListBlock } from './reminder-list.block';

class FakeReminderListInteractor {
  items: Reminder[] = [];
  readonly added: string[] = [];
  readonly renamed: { id: string; text: string }[] = [];
  readonly completed: string[] = [];
  readonly reopened: string[] = [];
  readonly removed: string[] = [];

  list(): Promise<Reminder[]> {
    return Promise.resolve(this.items);
  }

  add(text: string): Promise<void> {
    this.added.push(text);
    this.items = [...this.items, { id: `id-${this.items.length}`, text, completed: false }];
    return Promise.resolve();
  }

  rename(id: string, text: string): Promise<void> {
    this.renamed.push({ id, text });
    return Promise.resolve();
  }

  complete(id: string): Promise<void> {
    this.completed.push(id);
    return Promise.resolve();
  }

  reopen(id: string): Promise<void> {
    this.reopened.push(id);
    return Promise.resolve();
  }

  remove(id: string): Promise<void> {
    this.removed.push(id);
    this.items = this.items.filter((item) => item.id !== id);
    return Promise.resolve();
  }
}

/** Answers with a fixed result instead of opening a real overlay; the sheet chrome has its own spec. */
class StubSheetService {
  results: unknown[] = [];
  readonly headings: string[] = [];

  open(_content: unknown, config: { heading: string }): { closed: Observable<unknown> } {
    this.headings.push(config.heading);
    return { closed: of(this.results.shift()) };
  }
}

async function setup(items: Reminder[] = []) {
  const interactor = new FakeReminderListInteractor();
  interactor.items = items;
  const sheets = new StubSheetService();

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: ReminderListInteractor, useValue: interactor },
      { provide: SheetService, useValue: sheets },
    ],
  });

  const fixture = TestBed.createComponent(ReminderListBlock);
  await fixture.whenStable();

  const element = fixture.nativeElement as HTMLElement;

  return {
    element,
    interactor,
    sheets,
    settle: () => fixture.whenStable(),
    rows: () => Array.from(element.querySelectorAll('li')),
    input: () => element.querySelector('input[type="text"]') as HTMLInputElement,
    /** The field only exists once the last row has been used, so most tests start here. */
    async startAdding() {
      await this.clickByText('button', 'Punkt hinzufügen');
    },
    async type(value: string) {
      const input = this.input();
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    },
    async submit() {
      element.querySelector('form')!.dispatchEvent(new Event('submit'));
      await fixture.whenStable();
    },
    async click(selector: string, index = 0) {
      Array.from(element.querySelectorAll<HTMLElement>(selector))[index].click();
      await fixture.whenStable();
    },
    async clickByText(selector: string, text: string) {
      const match = Array.from(element.querySelectorAll<HTMLElement>(selector)).find((candidate) =>
        candidate.textContent?.includes(text),
      );
      match!.click();
      await fixture.whenStable();
    },
    /** Opens the menu of the given row and picks one of its items. */
    async chooseAction(rowIndex: number, label: string) {
      const row = this.rows()[rowIndex];
      row.querySelector<HTMLElement>('[ngMenuTrigger]')!.click();
      await fixture.whenStable();

      const item = Array.from(row.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
        (candidate) => candidate.textContent?.includes(label),
      );
      item!.click();
      await fixture.whenStable();
    },
  };
}

const open: Reminder = { id: 'a', text: 'Blumen gießen', completed: false };
const done: Reminder = { id: 'b', text: 'Post holen', completed: true };

describe('ReminderListBlock', () => {
  it('invites the first entry when the list is empty', async () => {
    const { element } = await setup();

    expect(element.querySelector('ul')).toBeNull();
    expect(element.textContent).toContain('Hier ist noch nichts.');
  });

  it('renders one list item per entry', async () => {
    const { rows } = await setup([open, done]);

    expect(rows()).toHaveLength(2);
    expect(rows()[0].textContent).toContain('Blumen gießen');
  });

  it('labels each checkbox with the action it performs, not with the entry alone', async () => {
    const { element } = await setup([open, done]);

    const [first, second] = Array.from(
      element.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    );
    expect(first.getAttribute('aria-label')).toBe('„Blumen gießen“ als erledigt markieren');
    expect(second.getAttribute('aria-label')).toBe('„Post holen“ wieder als offen markieren');
    expect(second.checked).toBe(true);
  });

  it('marks a completed entry without relying on colour', async () => {
    const { rows } = await setup([done]);

    const text = rows()[0].querySelector('span.flex-1');
    expect(text?.classList).toContain('line-through');
  });

  it('names a row menu after its entry and offers both actions', async () => {
    const block = await setup([open]);
    const rows = block.rows;

    const trigger = rows()[0].querySelector('[ngMenuTrigger]');
    expect(trigger?.querySelector('.sr-only')?.textContent?.trim()).toBe(
      'Optionen für „Blumen gießen“',
    );
    expect(trigger?.getAttribute('aria-haspopup')).toBe('true');
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
    // The items are rendered on demand, so a closed menu is not in the accessibility tree at all.
    expect(rows()[0].querySelectorAll('[role="menuitem"]')).toHaveLength(0);

    await block.click('[ngMenuTrigger]');

    expect(trigger?.getAttribute('aria-expanded')).toBe('true');
    expect(
      Array.from(rows()[0].querySelectorAll('[role="menuitem"]')).map((item) =>
        item.textContent?.trim(),
      ),
    ).toEqual(['Bearbeiten', 'Löschen']);
  });

  it('opens the field only once adding is asked for, and puts the caret in it', async () => {
    const block = await setup();

    expect(block.element.querySelector('input[type="text"]')).toBeNull();

    await block.startAdding();

    expect(block.input()).not.toBeNull();
    expect(document.activeElement).toBe(block.input());
  });

  it('closes the field again when the entry is abandoned', async () => {
    const block = await setup();
    await block.startAdding();
    await block.type('Halb getippt');

    await block.clickByText('button', 'Eingabe abbrechen');

    expect(block.element.querySelector('input[type="text"]')).toBeNull();
    expect(block.interactor.added).toEqual([]);
  });

  it('keeps the live region in the DOM before anything goes wrong', async () => {
    const block = await setup();
    await block.startAdding();

    expect(block.element.querySelector('[aria-live="polite"]')).not.toBeNull();
    expect(block.element.querySelector('.rk-error')).toBeNull();
  });

  it('answers an empty submit instead of writing an entry', async () => {
    const block = await setup();
    await block.startAdding();

    await block.submit();

    expect(block.interactor.added).toEqual([]);
    const error = block.element.querySelector('.rk-error');
    expect(error?.textContent?.trim()).not.toBe('');
    expect(block.input().getAttribute('aria-describedby')).toBe(error?.id);
    expect(document.activeElement).toBe(block.input());
  });

  it('adds a trimmed entry, clears the field and stays ready for the next one', async () => {
    const block = await setup();
    await block.startAdding();

    await block.type('  Blumen gießen ');
    await block.submit();

    expect(block.interactor.added).toEqual(['Blumen gießen']);
    expect(block.input().value).toBe('');
    expect(document.activeElement).toBe(block.input());
    expect(block.rows()).toHaveLength(1);
  });

  it('completes an open entry and reopens a completed one', async () => {
    const block = await setup([open, done]);

    await block.click('input[type="checkbox"]', 0);
    await block.click('input[type="checkbox"]', 1);

    expect(block.interactor.completed).toEqual(['a']);
    expect(block.interactor.reopened).toEqual(['b']);
  });

  it('applies an edit, and changes nothing when the edit is cancelled', async () => {
    const block = await setup([open]);

    block.sheets.results = ['Blumen gießen und lüften'];
    await block.chooseAction(0, 'Bearbeiten');
    expect(block.interactor.renamed).toEqual([{ id: 'a', text: 'Blumen gießen und lüften' }]);

    block.sheets.results = [undefined];
    await block.chooseAction(0, 'Bearbeiten');
    expect(block.interactor.renamed).toHaveLength(1);
  });

  it('deletes only after the confirmation is accepted', async () => {
    const block = await setup([open]);

    block.sheets.results = [false];
    await block.chooseAction(0, 'Löschen');
    expect(block.interactor.removed).toEqual([]);

    block.sheets.results = [undefined];
    await block.chooseAction(0, 'Löschen');
    expect(block.interactor.removed).toEqual([]);

    block.sheets.results = [true];
    await block.chooseAction(0, 'Löschen');
    await block.settle();
    expect(block.interactor.removed).toEqual(['a']);
    expect(block.sheets.headings).toEqual([
      'Erinnerung löschen?',
      'Erinnerung löschen?',
      'Erinnerung löschen?',
    ]);
  });
});
