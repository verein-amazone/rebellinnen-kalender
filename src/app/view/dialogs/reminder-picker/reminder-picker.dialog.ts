import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import type { ReminderOption } from '@app/interactors/notifications/reminder-labels';
import { SHEET_DATA, SheetRef } from '@app/view/components/sheet/sheet-ref';

export interface ReminderPickerDialogData {
  /** The presets still available - the ones already on the list are left out by the caller. */
  readonly options: readonly ReminderOption[];
}

/**
 * Picks one reminder to add. Closes with its minutes as soon as a row is tapped, like the calendar
 * picker and the platform calendar apps; dismissing yields `undefined`, which adds nothing.
 */
@Component({
  selector: 'app-reminder-picker',
  host: { class: 'block' },
  templateUrl: './reminder-picker.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReminderPickerDialog {
  protected readonly data = inject(SHEET_DATA) as ReminderPickerDialogData;
  private readonly sheetRef = inject<SheetRef<number>>(SheetRef);

  protected pick(minutes: number): void {
    this.sheetRef.close(minutes);
  }
}
