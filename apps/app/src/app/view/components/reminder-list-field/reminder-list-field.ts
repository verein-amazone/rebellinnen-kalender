import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { LucideBell, LucidePlus, LucideX } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';

import {
  MAX_REMINDERS,
  reminderLabel,
  reminderOptions,
} from '@app/interactors/notifications/reminder-labels';
import { SheetService } from '@app/view/components/sheet/sheet.service';
import {
  ReminderPickerDialog,
  type ReminderPickerDialogData,
} from '@app/view/dialogs/reminder-picker/reminder-picker.dialog';

/**
 * A list of reminders - minutes before the start - with a remove button per reminder and an „add“
 * row that opens the presets as a sheet, like the platform calendar apps. Holds at most
 * `MAX_REMINDERS`; the add row disappears once the list is full.
 *
 * A Signal Forms value control (`[formField]`) in the appointment form, and a plain two-way
 * `[(value)]` binding in the settings.
 */
@Component({
  selector: 'app-reminder-list-field',
  host: { class: 'block' },
  imports: [LucideBell, LucidePlus, LucideX],
  templateUrl: './reminder-list-field.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReminderListField implements FormValueControl<readonly number[]> {
  private readonly sheets = inject(SheetService);

  readonly value = model<readonly number[]>([]);
  /** All-day reminders are times of day („1 Tag vorher um 09:00“) rather than offsets. */
  readonly allDay = input<boolean>(false);
  /** The heading of the list, also its accessible name. */
  readonly label = input.required<string>();
  /** Also used to derive the heading's id, so keep it unique on the page. */
  readonly id = input.required<string>();

  protected readonly items = computed(() =>
    this.value().map((minutes) => ({ minutes, label: reminderLabel(minutes, this.allDay()) })),
  );
  protected readonly canAdd = computed(() => this.value().length < MAX_REMINDERS);
  protected readonly maxReminders = MAX_REMINDERS;

  protected remove(minutes: number): void {
    this.value.set(this.value().filter((reminder) => reminder !== minutes));
  }

  protected async add(): Promise<void> {
    const taken = new Set(this.value());
    const options = reminderOptions(this.allDay()).filter((option) => !taken.has(option.minutes));
    if (options.length === 0) {
      return;
    }

    const minutes = await firstValueFrom(
      this.sheets.open<number, ReminderPickerDialogData>(ReminderPickerDialog, {
        heading: 'Erinnerung hinzufügen',
        data: { options },
      }).closed,
    );
    if (minutes !== undefined) {
      // Earliest reminder first, the order the platform calendar apps list them in.
      this.value.set([...this.value(), minutes].sort((a, b) => b - a));
    }
  }
}
