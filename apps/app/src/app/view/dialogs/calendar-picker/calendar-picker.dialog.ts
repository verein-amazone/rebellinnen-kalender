import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LucideCheck } from '@lucide/angular';

import type { WritableAppCalendar } from '@app/interactors/calendar/app-calendars.interactor';
import { CalendarAvatar } from '@app/view/components/calendar-avatar/calendar-avatar';
import { SHEET_DATA, SheetRef } from '@app/view/components/sheet/sheet-ref';

export interface CalendarPickerDialogData {
  readonly calendars: readonly WritableAppCalendar[];
  readonly selectedId: string;
}

/**
 * Picks one writable calendar to create or move an appointment into - the app's own calendars and,
 * since #20, any enabled writable device calendar. Closes with the chosen id as soon as a row is
 * tapped - there is no separate confirm step, matching the platform calendar picker this is
 * modelled on. Dismissing through Escape or the backdrop yields `undefined`, which the trigger
 * treats as "unchanged".
 */
@Component({
  selector: 'app-calendar-picker',
  host: { class: 'block' },
  imports: [CalendarAvatar, LucideCheck],
  templateUrl: './calendar-picker.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarPickerDialog {
  protected readonly data = inject(SHEET_DATA) as CalendarPickerDialogData;
  private readonly sheetRef = inject<SheetRef<string>>(SheetRef);

  /**
   * Two same-named calendars from different sources (e.g. two "Familie" calendars) would otherwise
   * be indistinguishable in a flat list, so app and device calendars render under separate headings
   * whenever both are on offer.
   */
  protected readonly appCalendars = computed(() =>
    this.data.calendars.filter((calendar) => calendar.sourceType !== 'device'),
  );
  protected readonly deviceCalendars = computed(() =>
    this.data.calendars.filter((calendar) => calendar.sourceType === 'device'),
  );

  protected pick(id: string): void {
    this.sheetRef.close(id);
  }
}
