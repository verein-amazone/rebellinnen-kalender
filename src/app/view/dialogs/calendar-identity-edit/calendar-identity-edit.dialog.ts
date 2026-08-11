import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { APP_EVENT_TITLE_MAX_LENGTH } from '@app/interactors/calendar/app-event-editing.interactor';
import { SHEET_DATA, SheetRef } from '@app/view/components/sheet/sheet-ref';

export interface CalendarIdentityEditDialogData {
  readonly name: string;
  readonly color: string | null;
  readonly emoji: string | null;
}

export interface CalendarIdentityEditResult {
  readonly name: string;
  readonly color: string | null;
  readonly emoji: string | null;
}

/** Falls back to a neutral grey so the native colour input always has a valid value to open on. */
const DEFAULT_COLOR = '#94a3b8';

/**
 * Changes a calendar's name, colour and emoji — the app calendar's own identity editor, opened from
 * `CalendarsPage`.
 *
 * Closes with the new identity, or `undefined` when the change is cancelled or the sheet is
 * dismissed, mirroring `ReminderEditDialog`. A free colour picker and a plain emoji text field
 * (filled by the OS emoji keyboard) rather than a curated palette — there is only one call site, so
 * a bespoke field component is not justified yet.
 */
@Component({
  selector: 'app-calendar-identity-edit',
  host: { class: 'block' },
  templateUrl: './calendar-identity-edit.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarIdentityEditDialog {
  private readonly data = inject(SHEET_DATA) as CalendarIdentityEditDialogData;
  private readonly sheetRef = inject<SheetRef<CalendarIdentityEditResult>>(SheetRef);

  protected readonly maxLength = APP_EVENT_TITLE_MAX_LENGTH;
  protected readonly name = signal(this.data.name);
  protected readonly color = signal(this.data.color ?? DEFAULT_COLOR);
  protected readonly emoji = signal(this.data.emoji ?? '');
  protected readonly error = signal('');

  protected updateName(value: string): void {
    this.name.set(value);
    if (this.error() !== '') {
      this.error.set('');
    }
  }

  protected save(): void {
    const name = this.name().trim();
    if (name === '') {
      this.error.set('Bitte gib einen Namen ein.');
      return;
    }

    const emoji = this.emoji().trim();
    this.sheetRef.close({ name, color: this.color(), emoji: emoji === '' ? null : emoji });
  }

  protected cancel(): void {
    this.sheetRef.close();
  }
}
