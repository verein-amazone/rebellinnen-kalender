import { formatDate } from '@angular/common';

import { WEEKDAY_HEADERS } from '@app/cross-cutting/helpers/date-format';
import {
  parseRecurrenceRule,
  serializeRecurrenceRule,
  WEEKDAYS,
  weekdayOf,
  type RecurrenceFrequency,
  type RecurrenceRule,
  type Weekday,
} from '@app/data/calendar/recurrence/recurrence-rule';
import type { TemporalValue } from '@app/data/entities/temporal-value';

// The appointment form authors these, so they are part of the language views speak.
export {
  RECURRENCE_FREQUENCIES,
  WEEKDAYS,
  weekdayOf,
  type RecurrenceEnd,
  type RecurrenceFrequency,
  type RecurrenceRule,
  type Weekday,
} from '@app/data/calendar/recurrence/recurrence-rule';

/** The longest series the form lets the user count out - well past any real appointment series. */
export const RECURRENCE_MAX_COUNT = 999;

/** „Montag“, „Montag und Mittwoch“, „Montag, Mittwoch und Freitag“. */
const GERMAN_LIST = new Intl.ListFormat('de', { style: 'long', type: 'conjunction' });

function deviceZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** The stored RRULE value for a rule authored in the form; see `serializeRecurrenceRule`. */
export function toStoredRecurrence(rule: RecurrenceRule, start: TemporalValue): string {
  return serializeRecurrenceRule(rule, start, deviceZone());
}

/** The form-editable view of a stored rule, or `null` for one the form cannot represent. */
export function fromStoredRecurrence(rrule: string, start: TemporalValue): RecurrenceRule | null {
  return parseRecurrenceRule(rrule, start, deviceZone());
}

/** „Täglich“, „Wöchentlich“, … - the frequency picker's labels. */
export const RECURRENCE_FREQUENCY_LABELS: Readonly<Record<RecurrenceFrequency, string>> = {
  daily: 'Täglich',
  weekly: 'Wöchentlich',
  monthly: 'Monatlich',
  yearly: 'Jährlich',
};

/** The unit after „Alle 2 …“ in the interval field, singular and plural. */
export const RECURRENCE_INTERVAL_UNITS: Readonly<
  Record<RecurrenceFrequency, { readonly one: string; readonly other: string }>
> = {
  daily: { one: 'Tag', other: 'Tage' },
  weekly: { one: 'Woche', other: 'Wochen' },
  monthly: { one: 'Monat', other: 'Monate' },
  yearly: { one: 'Jahr', other: 'Jahre' },
};

/** `MO` → „Montag“. */
export function weekdayName(day: Weekday): string {
  return WEEKDAY_HEADERS[WEEKDAYS.indexOf(day)].long;
}

/**
 * A German sentence for a rule, e.g. „Alle 2 Wochen am Montag und Mittwoch, bis 31. Dezember 2026“.
 * `startDay` is the series' first day (`YYYY-MM-DD`): a monthly or yearly rule repeats on its date,
 * and a weekly rule always includes its weekday.
 */
export function describeRecurrence(rule: RecurrenceRule, startDay: string): string {
  const pattern = describePattern(rule, startDay);

  switch (rule.end.kind) {
    case 'never':
      return pattern;
    case 'until':
      return `${pattern}, bis ${formatDate(rule.end.date, 'd. MMMM y', 'de')}`;
    case 'count':
      return `${pattern}, ${rule.end.count === 1 ? 'einmal' : `${rule.end.count} Mal`}`;
  }
}

/**
 * The summary for a stored rule - its sentence when the form understands it, otherwise a neutral
 * label instead of guessing at a rule this app did not write.
 */
export function describeStoredRecurrence(rrule: string, start: TemporalValue): string {
  const rule = fromStoredRecurrence(rrule, start);
  return rule === null
    ? 'Wiederholt sich nach einer eigenen Regel'
    : describeRecurrence(rule, start.value.slice(0, 10));
}

function describePattern(rule: RecurrenceRule, startDay: string): string {
  const every = rule.interval === 1;
  switch (rule.frequency) {
    case 'daily':
      return every ? 'Jeden Tag' : `Alle ${rule.interval} Tage`;
    case 'weekly': {
      const days = new Set<Weekday>([...rule.weekdays, weekdayOf(startDay)]);
      const names = WEEKDAYS.filter((day) => days.has(day)).map(weekdayName);
      return `${every ? 'Jede Woche' : `Alle ${rule.interval} Wochen`} am ${GERMAN_LIST.format(names)}`;
    }
    case 'monthly': {
      const dayOfMonth = formatDate(startDay, 'd.', 'de');
      return `${every ? 'Jeden Monat' : `Alle ${rule.interval} Monate`} am ${dayOfMonth}`;
    }
    case 'yearly': {
      const date = formatDate(startDay, 'd. MMMM', 'de');
      return `${every ? 'Jedes Jahr' : `Alle ${rule.interval} Jahre`} am ${date}`;
    }
  }
}
