import { LiveAnnouncer } from '@angular/cdk/a11y';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, type Observable } from 'rxjs';

import { LocalDay } from '@app/cross-cutting/infrastructure/local-day';
import { ReminderChanges } from '@app/cross-cutting/infrastructure/reminder-changes';
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
  readonly moved: { id: string; toIndex: number }[] = [];
  listCalls = 0;

  list(): Promise<Reminder[]> {
    this.listCalls += 1;
    return Promise.resolve(this.items);
  }

  /** Rearranges the section the entry is in, the way the real interactor's positions would. */
  move(id: string, toIndex: number): Promise<void> {
    this.moved.push({ id, toIndex });

    const entry = this.items.find((item) => item.id === id);
    if (entry === undefined) {
      return Promise.resolve();
    }

    const section = this.items.filter((item) => item.completed === entry.completed);
    const others = section.filter((item) => item.id !== id);
    const rearranged = [...others.slice(0, toIndex), entry, ...others.slice(toIndex)];
    const untouched = this.items.filter((item) => item.completed !== entry.completed);

    this.items = entry.completed ? [...untouched, ...rearranged] : [...rearranged, ...untouched];
    return Promise.resolve();
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

/** Records what was announced, so a spec can prove a move is spoken exactly once. */
class StubLiveAnnouncer {
  readonly announcements: string[] = [];

  announce(message: string): Promise<void> {
    this.announcements.push(message);
    return Promise.resolve();
  }
}

async function setup(items: Reminder[] = []) {
  const interactor = new FakeReminderListInteractor();
  interactor.items = items;
  const sheets = new StubSheetService();
  const announcer = new StubLiveAnnouncer();
  const day = signal('2026-08-06');

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: ReminderListInteractor, useValue: interactor },
      { provide: SheetService, useValue: sheets },
      { provide: LiveAnnouncer, useValue: announcer },
      { provide: LocalDay, useValue: { day: day.asReadonly() } },
    ],
  });

  const fixture = TestBed.createComponent(ReminderListBlock);
  await fixture.whenStable();

  const element = fixture.nativeElement as HTMLElement;
  const reminderChanges = TestBed.inject(ReminderChanges);

  return {
    element,
    interactor,
    sheets,
    announcer,
    day,
    reminderChanges,
    settle: () => fixture.whenStable(),
    /** The drop output is called directly: jsdom gives every element zero size, so a real CDK
     *  pointer drag cannot be simulated — and the gesture itself is the CDK's own tested surface. */
    async dropRow(entries: Reminder[], previousIndex: number, currentIndex: number) {
      const component = fixture.componentInstance as unknown as {
        drop(event: {
          previousIndex: number;
          currentIndex: number;
          container: { data: readonly Reminder[] };
        }): Promise<void>;
      };
      await component.drop({ previousIndex, currentIndex, container: { data: entries } });
      await fixture.whenStable();
    },
    /** Whether the CDK may put the entry at that index — the guard that keeps a drag in its group. */
    mayDropAt(item: Reminder, index: number) {
      const component = fixture.componentInstance as unknown as {
        sortPredicate(index: number, drag: { data: Reminder }): boolean;
      };
      return component.sortPredicate(index, { data: item });
    },
    lists: () => Array.from(element.querySelectorAll('ul')),
    texts: () =>
      Array.from(element.querySelectorAll('li label > span')).map((span) =>
        span.textContent?.trim(),
      ),
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
    /** Opens the menu of the given row and leaves it open, so its items can be inspected. */
    async chooseActionMenu(rowIndex: number) {
      this.rows()[rowIndex].querySelector<HTMLElement>('[ngMenuTrigger]')!.click();
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

  it('notifies ReminderChanges after completing an entry, so the Today closing message can react', async () => {
    const block = await setup([open]);
    const before = block.reminderChanges.version();

    await block.click('input[type="checkbox"]', 0);

    expect(block.reminderChanges.version()).not.toBe(before);
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

  describe('one list, two groups', () => {
    it('shows every entry in a single list, in the order it was given', async () => {
      const block = await setup([open, done]);

      expect(block.lists()).toHaveLength(1);
      expect(block.texts()).toEqual(['Blumen gießen', 'Post holen']);
    });

    it('adds no section heading between the two groups', async () => {
      const block = await setup([open, done]);

      expect(block.element.querySelector('h3')).toBeNull();
      expect(block.element.textContent).not.toContain('Erledigt ');
    });

    it('refuses a drop position outside the entry’s own group', async () => {
      const block = await setup([open, done]);

      // One open entry, so index 0 is the open group and index 1 the completed one.
      expect(block.mayDropAt(open, 0)).toBe(true);
      expect(block.mayDropAt(open, 1)).toBe(false);
      expect(block.mayDropAt(done, 1)).toBe(true);
      expect(block.mayDropAt(done, 0)).toBe(false);
    });

    it('never connects the list to another one, so nothing can be dragged out of it', async () => {
      const block = await setup([open, done]);

      expect(block.lists()[0].hasAttribute('cdkDropListConnectedTo')).toBe(false);
    });
  });

  describe('reordering', () => {
    const second: Reminder = { id: 'c', text: 'Brot kaufen', completed: false };

    it('offers a move in both directions, except where it would do nothing', async () => {
      const block = await setup([open, second]);

      await block.chooseActionMenu(0);
      expect(labelsOf(block.rows()[0])).toEqual(['Nach unten', 'Bearbeiten', 'Löschen']);

      await block.chooseActionMenu(1);
      expect(labelsOf(block.rows()[1])).toEqual(['Nach oben', 'Bearbeiten', 'Löschen']);
    });

    it('moves an entry up from its menu and shows the new order right away', async () => {
      const block = await setup([open, second]);

      await block.chooseAction(1, 'Nach oben');

      expect(block.interactor.moved).toEqual([{ id: 'c', toIndex: 0 }]);
      expect(block.texts()).toEqual(['Brot kaufen', 'Blumen gießen']);
    });

    it('announces the new position once, and does not also print it on screen', async () => {
      const block = await setup([open, second]);

      await block.chooseAction(1, 'Nach oben');

      expect(block.announcer.announcements).toEqual([
        '„Brot kaufen“ ist jetzt an Position 1 von 2',
      ]);
      expect(block.element.textContent).not.toContain('Position');
    });

    it('leaves focus on the menu of the entry that moved', async () => {
      const block = await setup([open, second]);

      await block.chooseAction(1, 'Nach oben');
      await block.settle();

      expect(document.activeElement?.textContent).toContain('Brot kaufen');
    });

    it('turns a drop into a move to the index it was dropped at', async () => {
      const block = await setup([open, second]);

      await block.dropRow([open, second], 1, 0);

      expect(block.interactor.moved).toEqual([{ id: 'c', toIndex: 0 }]);
    });

    it('writes nothing when a row is dropped where it already was', async () => {
      const block = await setup([open, second]);

      await block.dropRow([open, second], 1, 1);

      expect(block.interactor.moved).toEqual([]);
    });

    it('reorders inside the completed group without touching the open entries', async () => {
      const alsoDone: Reminder = { id: 'd', text: 'Müll rausbringen', completed: true };
      const block = await setup([open, done, alsoDone]);

      // Row 2 is the second completed entry, so the index the interactor sees has to be its index
      // among the completed ones, not its index in the list on screen.
      await block.chooseAction(2, 'Nach oben');

      expect(block.interactor.moved).toEqual([{ id: 'd', toIndex: 0 }]);
      expect(block.texts()).toEqual(['Blumen gießen', 'Müll rausbringen', 'Post holen']);
    });

    it('reads a drop index in the whole list back into the entry’s own group', async () => {
      const alsoDone: Reminder = { id: 'd', text: 'Müll rausbringen', completed: true };
      const block = await setup([open, done, alsoDone]);

      // Dropped at the end of the list: the last completed entry, which is index 1 of that group.
      await block.dropRow([open, done, alsoDone], 1, 2);

      expect(block.interactor.moved).toEqual([{ id: 'b', toIndex: 1 }]);
    });

    it('keeps the drag handle out of the accessibility tree and out of the tab order', async () => {
      const block = await setup([open, second]);

      const handle = block.rows()[0].querySelector('[cdkDragHandle]');
      expect(handle?.getAttribute('aria-hidden')).toBe('true');
      expect(handle?.tagName).toBe('SPAN');
      expect(handle?.hasAttribute('tabindex')).toBe(false);
    });
  });

  it('loads the list again when the day rolls over', async () => {
    const block = await setup([open]);
    const before = block.interactor.listCalls;

    block.day.set('2026-08-07');
    await block.settle();

    expect(block.interactor.listCalls).toBe(before + 1);
  });
});

/** The labels of an open row menu, in the order they are offered. */
function labelsOf(row: Element): (string | undefined)[] {
  return Array.from(row.querySelectorAll('[role="menuitem"]')).map((item) =>
    item.textContent?.trim(),
  );
}
