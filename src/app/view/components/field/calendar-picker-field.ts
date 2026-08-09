import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { Field } from '@angular/forms/signals';
import { LucideChevronRight } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';

import type { WritableAppCalendar } from '@app/interactors/calendar/app-calendars.interactor';
import { CalendarAvatar } from '@app/view/components/calendar-avatar/calendar-avatar';
import {
  CalendarPickerDialog,
  type CalendarPickerDialogData,
} from '@app/view/dialogs/calendar-picker/calendar-picker.dialog';
import { SheetService } from '@app/view/components/sheet/sheet.service';

/**
 * A settings-style row that opens `CalendarPickerDialog` as a sheet, instead of the inline radios
 * `RadioGroupField` would render — there is only ever one choice worth seeing at a glance here, so
 * the picker stays out of the way until asked for, matching the platform calendar app.
 */
@Component({
  selector: 'app-calendar-picker-field',
  // `id` is a plain `@Input`, so a static `id="…"` in a consumer's template also reflects onto
  // this host element by default — duplicating the id the inner `<button>` needs. `[attr.id]: null`
  // strips it back off the host once host bindings apply.
  host: { class: 'block', '[attr.id]': 'null' },
  imports: [CalendarAvatar, LucideChevronRight],
  templateUrl: './calendar-picker-field.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarPickerField {
  private readonly sheets = inject(SheetService);

  /** Also used to derive the error message's id, so keep it unique on the page. */
  readonly id = input.required<string>();
  readonly field = input.required<Field<string>>();
  readonly calendars = input.required<readonly WritableAppCalendar[]>();

  protected readonly state = computed(() => this.field()());
  protected readonly selected = computed(() =>
    this.calendars().find((calendar) => calendar.id === this.state().value()),
  );
  protected readonly showError = computed(() => this.state().touched() && this.state().invalid());
  protected readonly errorMessage = computed(() => this.state().errors()[0]?.message ?? '');
  protected readonly errorId = computed(() => `${this.id()}-error`);

  protected async open(): Promise<void> {
    const calendars = this.calendars();
    if (calendars.length === 0) {
      return;
    }

    const result = await firstValueFrom(
      this.sheets.open<string, CalendarPickerDialogData>(CalendarPickerDialog, {
        heading: 'Kalender',
        data: { calendars, selectedId: this.state().value() },
      }).closed,
    );

    this.state().markAsTouched();
    if (result !== undefined) {
      this.state().value.set(result);
    }
  }
}
