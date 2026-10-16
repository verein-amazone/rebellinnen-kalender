import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { Field } from '@angular/forms/signals';
import { FormField } from '@angular/forms/signals';
import { LucideChevronDown } from '@lucide/angular';

import { WEEKDAY_HEADERS } from '@app/cross-cutting/helpers/date-format';
import {
  describeRecurrence,
  RECURRENCE_FREQUENCIES,
  RECURRENCE_FREQUENCY_LABELS,
  RECURRENCE_INTERVAL_UNITS,
  WEEKDAYS,
  weekdayOf,
  type RecurrenceFrequency,
  type Weekday,
} from '@app/interactors/calendar/recurrence';
import { CheckHaptics } from '@app/view/components/field/check-haptics';
import {
  RadioGroupField,
  type RadioGroupOption,
} from '@app/view/components/field/radio-group-field';

/**
 * What the „Wiederholen“ picker holds: no repetition, one of the authorable frequencies, or a stored
 * rule the form cannot represent - which is kept as it is until the user picks something else.
 */
export type RepeatChoice = 'none' | RecurrenceFrequency | 'custom';

export type RepeatEndChoice = 'never' | 'until' | 'count';

const END_OPTIONS: readonly RadioGroupOption<RepeatEndChoice>[] = [
  { value: 'never', label: 'Nie' },
  { value: 'until', label: 'An einem Datum' },
  { value: 'count', label: 'Nach einer Anzahl von Terminen' },
];

/**
 * The appointment's repetition, collapsed to a one-line summary like the date row above it and
 * expanded on tap.
 *
 * Every control is native: a `<select>` for the frequency, a number input for the interval, a
 * fieldset of checkboxes for the weekdays and native radios for the end. The start's own weekday is
 * always part of a weekly series (it is the first occurrence), so its checkbox stays ticked and
 * disabled rather than offering a choice that would not do anything.
 */
@Component({
  selector: 'app-recurrence-field',
  host: { class: 'block' },
  imports: [CheckHaptics, FormField, LucideChevronDown, RadioGroupField],
  templateUrl: './recurrence-field.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecurrenceField {
  /** Also used to derive the sub-fields' ids, so keep it unique on the page. */
  readonly id = input.required<string>();
  readonly repeatField = input.required<Field<RepeatChoice>>();
  readonly intervalField = input.required<Field<number>>();
  readonly weekdaysField = input.required<Field<Weekday[]>>();
  readonly endField = input.required<Field<RepeatEndChoice>>();
  readonly untilDateField = input.required<Field<string>>();
  readonly countField = input.required<Field<number>>();
  /** The appointment's start day, `YYYY-MM-DD` - a weekly series always includes its weekday. */
  readonly startDate = input.required<string>();
  /** The summary of a stored rule the form cannot edit; `null` when there is none. */
  readonly customSummary = input<string | null>(null);

  protected readonly expanded = signal(false);
  protected readonly endOptions = END_OPTIONS;

  protected readonly repeat = computed(() => this.repeatField()().value());
  protected readonly frequency = computed(() => {
    const repeat = this.repeat();
    return repeat === 'none' || repeat === 'custom' ? null : repeat;
  });

  protected readonly frequencyOptions = computed(() => [
    { value: 'none', label: 'Nie' },
    ...RECURRENCE_FREQUENCIES.map((frequency) => ({
      value: frequency,
      label: RECURRENCE_FREQUENCY_LABELS[frequency],
    })),
    ...(this.customSummary() !== null ? [{ value: 'custom', label: 'Eigene Regel' }] : []),
  ]);

  protected readonly intervalUnit = computed(() => {
    const frequency = this.frequency();
    if (frequency === null) {
      return '';
    }
    const units = RECURRENCE_INTERVAL_UNITS[frequency];
    return this.intervalField()().value() === 1 ? units.one : units.other;
  });

  private readonly startWeekday = computed(() => {
    const day = this.startDate();
    return day === '' ? null : weekdayOf(day);
  });

  protected readonly weekdayOptions = computed(() => {
    const selected = new Set(this.weekdaysField()().value());
    const start = this.startWeekday();
    return WEEKDAYS.map((day, index) => ({
      day,
      short: WEEKDAY_HEADERS[index].short,
      long: WEEKDAY_HEADERS[index].long,
      isStart: day === start,
      checked: day === start || selected.has(day),
    }));
  });

  protected readonly summary = computed(() => {
    const repeat = this.repeat();
    if (repeat === 'none') {
      return 'Nie';
    }
    if (repeat === 'custom') {
      return this.customSummary() ?? 'Eigene Regel';
    }

    const startDate = this.startDate();
    if (startDate === '') {
      return RECURRENCE_FREQUENCY_LABELS[repeat];
    }

    const interval = this.intervalField()().value();
    const count = this.countField()().value();
    const until = this.untilDateField()().value();
    const endChoice = this.endField()().value();
    return describeRecurrence(
      {
        frequency: repeat,
        interval: Number.isInteger(interval) && interval > 0 ? interval : 1,
        weekdays: this.weekdaysField()().value(),
        end:
          endChoice === 'count' && Number.isInteger(count) && count > 0
            ? { kind: 'count', count }
            : endChoice === 'until' && until !== ''
              ? { kind: 'until', date: until }
              : { kind: 'never' },
      },
      startDate,
    );
  });

  /** The first error of the visible sub-fields, for the shared live region below the control. */
  protected readonly error = computed(() => {
    const fields = [this.intervalField()(), this.untilDateField()(), this.countField()()];
    const failing = fields.find((state) => state.touched() && state.invalid());
    return failing?.errors()[0]?.message ?? null;
  });

  protected toggleExpanded(): void {
    this.expanded.update((expanded) => !expanded);
  }

  protected onWeekdayChange(day: Weekday, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const state = this.weekdaysField()();
    const others = state.value().filter((selected) => selected !== day);
    state.value.set(checked ? WEEKDAYS.filter((d) => d === day || others.includes(d)) : others);
    state.markAsTouched();
  }
}
