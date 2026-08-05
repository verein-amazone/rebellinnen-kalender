import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { REMINDER_TEXT_MAX_LENGTH } from '@app/interactors/reminders/reminder-list.interactor';
import { SHEET_DATA, SheetRef } from '@app/view/components/sheet/sheet-ref';

export interface ReminderEditDialogData {
  /** The current text, shown prefilled so a small correction does not mean retyping the entry. */
  readonly text: string;
}

/**
 * Changes the text of one „Nicht vergessen“ entry.
 *
 * Closes with the new text, or with `undefined` when the change is cancelled or the sheet is
 * dismissed — so cancelling leaves the entry exactly as it was.
 */
@Component({
  selector: 'app-reminder-edit',
  host: { class: 'block' },
  templateUrl: './reminder-edit.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReminderEditDialog {
  private readonly data = inject(SHEET_DATA) as ReminderEditDialogData;
  private readonly sheetRef = inject<SheetRef<string>>(SheetRef);

  protected readonly maxLength = REMINDER_TEXT_MAX_LENGTH;
  protected readonly draft = signal(this.data.text);
  protected readonly error = signal('');

  protected updateDraft(value: string): void {
    this.draft.set(value);

    if (this.error() !== '') {
      this.error.set('');
    }
  }

  protected save(): void {
    const text = this.draft().trim();

    if (text === '') {
      this.error.set('Bitte gib einen Text ein.');
      return;
    }

    this.sheetRef.close(text);
  }

  protected cancel(): void {
    this.sheetRef.close();
  }
}
