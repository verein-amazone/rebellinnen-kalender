import { LiveAnnouncer } from '@angular/cdk/a11y';
import {
  CdkDrag,
  CdkDragHandle,
  CdkDropList,
  moveItemInArray,
  type CdkDragDrop,
} from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@angular/aria/menu';
import {
  LucideArrowDown,
  LucideArrowUp,
  LucideEllipsis,
  LucideGripVertical,
  LucidePencil,
  LucidePlus,
  LucideTrash2,
  LucideX,
} from '@lucide/angular';

import { LocalDay } from '@app/cross-cutting/infrastructure/local-day';
import { ReminderChanges } from '@app/cross-cutting/infrastructure/reminder-changes';
import {
  REMINDER_TEXT_MAX_LENGTH,
  ReminderListInteractor,
} from '@app/interactors/reminders/reminder-list.interactor';
import type { Reminder } from '@app/interactors/reminders/reminder.vm';
import { SheetService } from '@app/view/components/sheet/sheet.service';
import {
  ConfirmationDialog,
  type ConfirmationDialogData,
} from '@app/view/dialogs/confirmation/confirmation.dialog';
import {
  ReminderEditDialog,
  type ReminderEditDialogData,
} from '@app/view/dialogs/reminder-edit/reminder-edit.dialog';

/** What a row's menu can do. The menu emits one of these; the block turns it into a use case. */
export type ReminderAction = 'move-up' | 'move-down' | 'edit' | 'delete';

/**
 * The „Nicht vergessen“ list: add an entry, tick it off, put it where you want it, correct it, remove
 * it.
 *
 * A block rather than part of the Today page, because Today grows a greeting, an impulse and the
 * day's appointments around it and would otherwise carry all of their state in one component.
 *
 * The list itself lives here as a `resource`, not in the interactor: interactors are stateless, and
 * this is the only screen showing the list. `reload()` after a write keeps the previous value while
 * the new one loads, so ticking an entry does not blink through the empty state. The resource depends
 * on the local day, so entries completed yesterday disappear at midnight without anyone reopening the
 * app.
 *
 * Open and completed entries are two lists rather than one, and the two are deliberately not
 * connected: dragging can rearrange a section but never complete or reopen an entry — the checkbox
 * stays the only way across. Dragging is also never the only way to move a row; the same moves sit in
 * the row's menu, which is what makes them reachable by tap and by keyboard.
 *
 * Adding happens in the last row of the card, which is a button until it is used and an input
 * afterwards — so the quiet state stays quiet and the field only appears once it is wanted.
 */
@Component({
  selector: 'app-reminder-list',
  host: { class: 'block' },
  imports: [
    CdkDrag,
    CdkDragHandle,
    CdkDropList,
    Menu,
    MenuContent,
    MenuItem,
    MenuTrigger,
    LucideArrowDown,
    LucideArrowUp,
    LucideEllipsis,
    LucideGripVertical,
    LucidePencil,
    LucidePlus,
    LucideTrash2,
    LucideX,
  ],
  templateUrl: './reminder-list.block.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReminderListBlock {
  private readonly reminders = inject(ReminderListInteractor);
  private readonly sheets = inject(SheetService);
  private readonly announcer = inject(LiveAnnouncer);
  private readonly currentDay = inject(LocalDay);
  private readonly reminderChanges = inject(ReminderChanges);

  private readonly input = viewChild<ElementRef<HTMLInputElement>>('newReminderInput');

  protected readonly items = resource({
    // Reloads by itself when the day rolls over, which is when completed entries stop being shown.
    params: () => this.currentDay.day(),
    loader: () => this.reminders.list(),
  });

  /**
   * The order a completed move produced, until the next load replaces it.
   *
   * A move is written before it is shown, so this is not an optimistic guess: it is the same order
   * the database would return, applied without waiting for a round trip. Reloading anyway would let
   * the row snap back to where it came from for one frame.
   */
  private readonly ordered = signal<readonly Reminder[] | null>(null);

  protected readonly entries = computed(() => this.ordered() ?? this.items.value() ?? []);

  protected readonly openItems = computed(() => this.entries().filter((item) => !item.completed));
  protected readonly doneItems = computed(() => this.entries().filter((item) => item.completed));
  protected readonly isEmpty = computed(() => this.entries().length === 0);

  /**
   * One list, with the open entries first and the completed ones after them — no headings between.
   *
   * That the open entries come first and are contiguous is the data layer's guarantee, not something
   * re-established here: the list is read in exactly that order (see `ReminderDao.listAll`). The group
   * arithmetic below relies on it.
   *
   * The two groups are still two groups as far as moving goes: an entry only ever moves among its
   * own kind, and the checkbox stays the one way across. Each row therefore carries where it sits
   * *within its group*, because that is the index the interactor works in and the index the „Nach
   * oben“ / „Nach unten“ items have to be decided from.
   *
   * The rows have to be real children of the `<ul>` in the template: rendering them through an
   * `ng-template` made Angular re-create a row that had only moved, so the row vanished mid-move, and
   * it put the row outside the reach of the drop list, which stopped dragging working at all.
   */
  protected readonly rows = computed(() => {
    const openCount = this.openItems().length;

    return this.entries().map((item, index) => ({
      item,
      groupIndex: item.completed ? index - openCount : index,
      groupSize: item.completed ? this.entries().length - openCount : openCount,
    }));
  });

  protected readonly maxLength = REMINDER_TEXT_MAX_LENGTH;
  protected readonly adding = signal(false);
  protected readonly draft = signal('');
  protected readonly error = signal('');

  constructor() {
    // The field is opened by a button press, so the press has to end with the caret in the field.
    effect(() => {
      if (this.adding()) {
        this.input()?.nativeElement.focus();
      }
    });

    // A new day means a new list, so a hand-made order from yesterday must not survive it.
    effect(() => {
      this.currentDay.day();
      this.ordered.set(null);
    });
  }

  protected startAdding(): void {
    this.adding.set(true);
  }

  protected cancelAdding(): void {
    this.adding.set(false);
    this.draft.set('');
    this.error.set('');
  }

  protected updateDraft(value: string): void {
    this.draft.set(value);

    if (this.error() !== '') {
      this.error.set('');
    }
  }

  /**
   * The confirm button stays enabled even with an empty field: a disabled control cannot be reached
   * and explains nothing, so an empty submit answers instead.
   */
  protected async add(): Promise<void> {
    const text = this.draft().trim();

    if (text === '') {
      this.error.set('Bitte gib zuerst einen Text ein.');
      this.input()?.nativeElement.focus();
      return;
    }

    await this.reminders.add(text);
    this.draft.set('');
    this.reload();
    // The field stays open and focused, so several entries can be written one after another.
    this.input()?.nativeElement.focus();
  }

  protected async toggle(item: Reminder): Promise<void> {
    if (item.completed) {
      await this.reminders.reopen(item.id);
    } else {
      await this.reminders.complete(item.id);
    }

    this.reload();
  }

  /** The label states what activating the control will do, not what the current state is. */
  protected toggleLabel(item: Reminder): string {
    return item.completed
      ? `„${item.text}“ wieder als offen markieren`
      : `„${item.text}“ als erledigt markieren`;
  }

  /**
   * Keeps a dragged row inside its own group while the drag is still happening.
   *
   * With one list there is no structural barrier between the open and the completed entries any more,
   * so this is what stops a drag from doing what only the checkbox may do. Refusing the position
   * rather than correcting it afterwards means the gap never opens on the wrong side of the boundary,
   * so it never looks as though dropping there would complete the entry.
   *
   * An arrow property because the CDK calls it unbound.
   */
  protected readonly sortPredicate = (index: number, drag: CdkDrag<Reminder>): boolean => {
    const openCount = this.openItems().length;
    return drag.data.completed ? index >= openCount : index < openCount;
  };

  /** A row was dropped. The index is over the whole list, so it is read back into its group. */
  protected async drop(event: CdkDragDrop<readonly Reminder[]>): Promise<void> {
    if (event.previousIndex === event.currentIndex) {
      return;
    }

    const item = event.container.data[event.previousIndex];
    if (item === undefined) {
      return;
    }

    const openCount = this.openItems().length;
    const group = item.completed ? this.doneItems() : this.openItems();
    const target = clamp(
      item.completed ? event.currentIndex - openCount : event.currentIndex,
      0,
      group.length - 1,
    );

    await this.moveWithin(item, group, group.indexOf(item), target);
  }

  /** The same move from the row's menu, one step at a time. */
  protected async moveBy(item: Reminder, groupIndex: number, offset: number): Promise<void> {
    const group = item.completed ? this.doneItems() : this.openItems();
    const target = groupIndex + offset;

    if (target < 0 || target >= group.length) {
      return;
    }

    await this.moveWithin(item, group, groupIndex, target);
  }

  protected runAction(action: ReminderAction, item: Reminder, groupIndex: number): void {
    switch (action) {
      case 'move-up':
        void this.moveBy(item, groupIndex, -1);
        return;
      case 'move-down':
        void this.moveBy(item, groupIndex, 1);
        return;
      case 'edit':
        this.edit(item);
        return;
      case 'delete':
        this.confirmDelete(item);
    }
  }

  private async moveWithin(
    item: Reminder,
    group: readonly Reminder[],
    from: number,
    to: number,
  ): Promise<void> {
    if (from === to || from < 0) {
      return;
    }

    const reordered = [...group];
    moveItemInArray(reordered, from, to);
    await this.applyMove(item, reordered, to);
  }

  /**
   * Writes the move, then shows the section in its new order.
   *
   * The new position is announced through the `LiveAnnouncer` and nowhere else: after a drop nothing
   * on screen states where the row ended up, and after a menu selection the menu that was operated
   * has already closed. A second, visible live region would make one move sound like two.
   */
  private async applyMove(
    item: Reminder,
    section: readonly Reminder[],
    toIndex: number,
  ): Promise<void> {
    try {
      await this.reminders.move(item.id, toIndex);
    } catch {
      // The order on screen would otherwise claim a move that never reached the database.
      this.reload();
      return;
    }

    this.ordered.set(
      item.completed ? [...this.openItems(), ...section] : [...section, ...this.doneItems()],
    );
    this.announcer.announce(
      `„${item.text}“ ist jetzt an Position ${toIndex + 1} von ${section.length}`,
    );
  }

  private edit(item: Reminder): void {
    const data: ReminderEditDialogData = { text: item.text };

    this.sheets
      .open<string, ReminderEditDialogData>(ReminderEditDialog, {
        heading: 'Erinnerung bearbeiten',
        data,
      })
      .closed.subscribe(async (text) => {
        // `undefined` means cancelled or dismissed, and must leave the entry untouched.
        if (text === undefined) {
          return;
        }

        await this.reminders.rename(item.id, text);
        this.reload();
      });
  }

  private confirmDelete(item: Reminder): void {
    const data: ConfirmationDialogData = {
      message: `„${item.text}“ wird gelöscht. Das kann nicht rückgängig gemacht werden.`,
      confirmLabel: 'Löschen',
      destructive: true,
    };

    this.sheets
      .open<boolean, ConfirmationDialogData>(ConfirmationDialog, {
        heading: 'Erinnerung löschen?',
        data,
      })
      .closed.subscribe(async (confirmed) => {
        if (confirmed !== true) {
          return;
        }

        await this.reminders.remove(item.id);
        this.reload();
        // The row simply disappears, and focus has returned to the page heading by now, so the
        // outcome would otherwise go unannounced.
        this.announcer.announce(`„${item.text}“ gelöscht`);
      });
  }

  /**
   * Every reload drops the hand-made order: the list that arrives is the one to show. Also the one
   * place every write funnels through, so it doubles as the notification the Today page's closing
   * message — a sibling block with no other view of this list — reacts to.
   */
  protected reload(): void {
    this.ordered.set(null);
    this.items.reload();
    this.reminderChanges.notify();
  }
}

function clamp(value: number, lowest: number, highest: number): number {
  return Math.min(Math.max(value, lowest), highest);
}
