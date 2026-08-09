import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
  signal,
} from '@angular/core';
import type { Field } from '@angular/forms/signals';
import { FormField } from '@angular/forms/signals';
import { LucideChevronDown } from '@lucide/angular';
import { Temporal } from 'temporal-polyfill';

/**
 * The appointment's date and time, collapsed to a one-line summary that expands to "Starts"/"Ends"/
 * "All-day" rows on tap — inspired by the platform calendar app's own date row. Both a timed
 * appointment and an all-day one have independently editable start and end dates, so an overnight
 * span (22:00 one day through 02:00 the next) or a multi-day all-day appointment are both normal
 * edits, not hidden bookkeeping.
 *
 * The date and time pickers stay native `<input type="date">`/`<input type="time">`, styled as
 * compact pills with `.rk-field`/`.rk-input` — per the accessibility order of preference, native
 * HTML beats a custom picker, and it is what the rest of the form already uses.
 */
@Component({
  selector: 'app-date-time-field',
  host: { class: 'block' },
  imports: [FormField, LucideChevronDown],
  templateUrl: './date-time-field.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DateTimeField {
  private readonly locale = inject(LOCALE_ID);

  /** Also used to derive the sub-fields' ids, so keep it unique on the page. */
  readonly id = input.required<string>();
  readonly dateField = input.required<Field<string>>();
  readonly startTimeField = input.required<Field<string>>();
  readonly endDateField = input.required<Field<string>>();
  readonly endTimeField = input.required<Field<string>>();
  readonly allDayField = input.required<Field<boolean>>();

  protected readonly expanded = signal(false);

  private readonly dateState = computed(() => this.dateField()());
  private readonly startTimeState = computed(() => this.startTimeField()());
  private readonly endDateState = computed(() => this.endDateField()());
  private readonly endTimeState = computed(() => this.endTimeField()());
  protected readonly allDayState = computed(() => this.allDayField()());

  protected readonly summary = computed(() => {
    const date = this.dateState().value();
    const datePart =
      date === '' ? '' : formatDate(`${date}T00:00:00`, 'EEE, d. MMM y', this.locale);

    if (this.allDayState().value()) {
      const endDate = this.endDateState().value();
      // Same as the timed case below: the end date only earns a mention once it differs from the
      // start date, since a same-day all-day appointment is the overwhelming majority.
      if (datePart === '') {
        return 'Ganztägig';
      }
      if (endDate !== '' && endDate !== date) {
        const endDatePart = formatDate(`${endDate}T00:00:00`, 'EEE, d. MMM y', this.locale);
        return `${datePart}–${endDatePart} · Ganztägig`;
      }
      return `${datePart} · Ganztägig`;
    }

    const start = this.startTimeState().value();
    const endDate = this.endDateState().value();
    const end = this.endTimeState().value();
    // The end date only earns its own mention in the summary once it differs from the start date —
    // the overwhelming majority of appointments start and end the same day.
    const endPart =
      endDate !== '' && endDate !== date
        ? `${formatDate(`${endDate}T00:00:00`, 'EEE, d. MMM y', this.locale)} ${end}`
        : end;
    const timePart = start === '' && end === '' ? '' : `${start}–${endPart}`;

    // A deep link to the create screen (no `?day=` prefill) leaves every field blank, which would
    // otherwise give this button empty accessible text — it still has to announce what it opens.
    return [datePart, timePart].filter((part) => part !== '').join(' · ') || 'Datum wählen';
  });

  protected toggleExpanded(): void {
    this.expanded.update((value) => !value);
  }

  /**
   * Turning Ganztägig off has to leave the time fields usable, not blank — an appointment that was
   * saved as all-day never had a start/end time to restore, the same situation a brand-new
   * appointment starts from. Mirrors `EventForm`'s own create-mode default: "now", rounded up to the
   * next quarter hour, with the end an hour later.
   */
  protected onAllDayChange(event: Event): void {
    const allDay = (event.target as HTMLInputElement).checked;
    this.allDayState().value.set(allDay);

    if (allDay) {
      return;
    }

    if (this.startTimeState().value() === '' && this.endTimeState().value() === '') {
      const startTime = Temporal.Now.plainTimeISO().round({
        smallestUnit: 'minute',
        roundingIncrement: 15,
        roundingMode: 'ceil',
      });
      this.startTimeState().value.set(startTime.toString({ smallestUnit: 'minute' }));
      this.endTimeState().value.set(
        startTime.add({ hours: 1 }).toString({ smallestUnit: 'minute' }),
      );
    }
  }
}
