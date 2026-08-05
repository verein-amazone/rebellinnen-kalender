import { LiveAnnouncer } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@angular/aria/menu';
import {
  LucideArrowUp,
  LucideEllipsis,
  LucidePencil,
  LucidePlus,
  LucideTrash2,
  LucideX,
} from '@lucide/angular';

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
export type ReminderAction = 'edit' | 'delete';

/**
 * The „Nicht vergessen“ list: add an entry, tick it off, correct it, remove it.
 *
 * A block rather than part of the Today page, because Today grows a greeting, an impulse and the
 * day's appointments around it and would otherwise carry all of their state in one component.
 *
 * The list itself lives here as a `resource`, not in the interactor: interactors are stateless, and
 * this is the only screen showing the list. `reload()` after a write keeps the previous value while
 * the new one loads, so ticking an entry does not blink through the empty state.
 *
 * Adding happens in the last row of the card, which is a button until it is used and an input
 * afterwards — so the quiet state stays quiet and the field only appears once it is wanted. The row's
 * own actions sit behind one menu instead of two permanent icon buttons, which keeps a row readable
 * at large text sizes.
 */
@Component({
  selector: 'app-reminder-list',
  host: { class: 'block' },
  imports: [
    Menu,
    MenuContent,
    MenuItem,
    MenuTrigger,
    LucideArrowUp,
    LucideEllipsis,
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

  private readonly input = viewChild<ElementRef<HTMLInputElement>>('newReminderInput');

  protected readonly items = resource({ loader: () => this.reminders.list() });
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
    this.items.reload();
    // The field stays open and focused, so several entries can be written one after another.
    this.input()?.nativeElement.focus();
  }

  protected async toggle(item: Reminder): Promise<void> {
    if (item.completed) {
      await this.reminders.reopen(item.id);
    } else {
      await this.reminders.complete(item.id);
    }

    this.items.reload();
  }

  /** The label states what activating the control will do, not what the current state is. */
  protected toggleLabel(item: Reminder): string {
    return item.completed
      ? `„${item.text}“ wieder als offen markieren`
      : `„${item.text}“ als erledigt markieren`;
  }

  protected runAction(action: ReminderAction, item: Reminder): void {
    if (action === 'edit') {
      this.edit(item);
      return;
    }

    this.confirmDelete(item);
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
        this.items.reload();
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
        this.items.reload();
        // The row simply disappears, and focus has returned to the page heading by now, so the
        // outcome would otherwise go unannounced.
        this.announcer.announce(`„${item.text}“ gelöscht`);
      });
  }
}
