import ICAL from 'ical.js';
import { Temporal } from 'temporal-polyfill';

import { deviceLocalDay } from '@app/cross-cutting/helpers/device-local-day';
import type { TemporalValue } from '../../entities/temporal-value';

export const RECURRENCE_FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

/** RFC 5545 weekday codes, Monday first - the order the app's week starts in. */
export const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export type RecurrenceEnd =
  | { readonly kind: 'never' }
  /** The last day an occurrence may start on, inclusive, as `YYYY-MM-DD`. */
  | { readonly kind: 'until'; readonly date: string }
  | { readonly kind: 'count'; readonly count: number };

/**
 * The repetition patterns the appointment form can author: every n days, weeks (on chosen
 * weekdays), months (on the start's day of month) or years (on the start's date), ending never, on
 * a day or after a number of occurrences.
 *
 * Deliberately a small subset of RFC 5545. Anything outside it - BYSETPOS, „the second Tuesday“,
 * several days of the month - is never rewritten by the form; `parseRecurrenceRule` reports it as
 * unsupported so the caller can keep the stored rule as it is.
 */
export interface RecurrenceRule {
  readonly frequency: RecurrenceFrequency;
  /** 1 or more: „every 2 weeks“ is `{frequency: 'weekly', interval: 2}`. */
  readonly interval: number;
  /** Only meaningful for `weekly`; always contains the start's own weekday once serialized. */
  readonly weekdays: readonly Weekday[];
  readonly end: RecurrenceEnd;
}

/** The weekday a `YYYY-MM-DD` day falls on. */
export function weekdayOf(day: string): Weekday {
  return WEEKDAYS[Temporal.PlainDate.from(day).dayOfWeek - 1];
}

/**
 * The stored RRULE value (no `RRULE:` prefix) for a rule starting at `start`, written by ical.js.
 *
 * A weekly rule always lists the start's own weekday: the materializer counts DTSTART as the first
 * occurrence (RFC 5545), so leaving it out would still produce that occurrence while the rule claims
 * it does not exist. UNTIL takes the kind of the start, as RFC 5545 requires - a date for an all-day
 * series, otherwise the last second of the chosen day in the start's zone, written as UTC.
 */
export function serializeRecurrenceRule(
  rule: RecurrenceRule,
  start: TemporalValue,
  deviceZone: string,
): string {
  const days = new Set<Weekday>([...rule.weekdays, weekdayOf(deviceLocalDay(start, deviceZone))]);
  return new ICAL.Recur({
    freq: rule.frequency.toUpperCase() as ICAL.Recur['freq'],
    ...(rule.interval > 1 ? { interval: rule.interval } : {}),
    ...(rule.frequency === 'weekly' ? { byday: WEEKDAYS.filter((day) => days.has(day)) } : {}),
    ...(rule.end.kind === 'count' ? { count: rule.end.count } : {}),
    ...(rule.end.kind === 'until'
      ? { until: ICAL.Time.fromString(untilOfDay(rule.end.date, start, deviceZone), null) }
      : {}),
  }).toString();
}

/**
 * The form-editable view of a stored RRULE value, or `null` when the rule uses anything the form
 * cannot represent without losing it. ical.js reads the value; this only decides whether it fits.
 */
export function parseRecurrenceRule(
  rrule: string,
  start: TemporalValue,
  deviceZone: string,
): RecurrenceRule | null {
  let recur: ICAL.Recur;
  try {
    recur = ICAL.Recur.fromString(rrule.trim().replace(/^RRULE:/i, ''));
  } catch {
    return null;
  }

  const frequency = recur.freq?.toLowerCase() ?? '';
  const { BYDAY: byDay = [], ...otherParts } = recur.parts as Record<string, string[]>;
  if (
    !isFrequency(frequency) ||
    Object.keys(otherParts).length > 0 ||
    recur.wkst !== ICAL.Time.MONDAY ||
    (recur.count !== null && recur.count < 1) ||
    // Ordinals („2TU“, „-1FR“) are outside what the form can show.
    !byDay.every(isWeekday) ||
    (byDay.length > 0 && frequency !== 'weekly')
  ) {
    return null;
  }

  return {
    frequency,
    interval: recur.interval,
    weekdays: byDay,
    end:
      recur.until !== null
        ? { kind: 'until', date: dayOfUntil(recur.until, start, deviceZone) }
        : recur.count !== null
          ? { kind: 'count', count: recur.count }
          : { kind: 'never' },
  };
}

/**
 * A stored rule moved from one start to another: weekly weekdays move by the same number of days
 * as the start (Monday and Thursday become Tuesday and Friday when the series moves a day later),
 * the new start's weekday is always included, and UNTIL is rewritten in the new start's kind - an
 * all-day series that becomes a timed one cannot keep a date UNTIL (RFC 5545). A rule the form
 * cannot represent is returned unchanged.
 */
export function rebaseRecurrenceRule(
  rrule: string,
  from: TemporalValue,
  to: TemporalValue,
  deviceZone: string,
): string {
  const rule = parseRecurrenceRule(rrule, from, deviceZone);
  if (rule === null) {
    return rrule;
  }

  const shift = Temporal.PlainDate.from(deviceLocalDay(from, deviceZone)).until(
    Temporal.PlainDate.from(deviceLocalDay(to, deviceZone)),
    { largestUnit: 'days' },
  ).days;
  const weekdays = rule.weekdays.map(
    (day) => WEEKDAYS[(((WEEKDAYS.indexOf(day) + shift) % 7) + 7) % 7],
  );
  return serializeRecurrenceRule({ ...rule, weekdays }, to, deviceZone);
}

function isFrequency(value: string): value is RecurrenceFrequency {
  return (RECURRENCE_FREQUENCIES as readonly string[]).includes(value);
}

function isWeekday(value: string): value is Weekday {
  return (WEEKDAYS as readonly string[]).includes(value);
}

/** UNTIL for the last day an occurrence may start on, as an ISO date, date-time or UTC instant. */
function untilOfDay(day: string, start: TemporalValue, deviceZone: string): string {
  const date = Temporal.PlainDate.from(day);
  switch (start.kind) {
    case 'date':
      return date.toString();
    case 'floating':
      return `${date.toString()}T23:59:59`;
    case 'zoned':
    case 'utc': {
      const zone = start.kind === 'zoned' ? (start.timeZone ?? deviceZone) : deviceZone;
      return date
        .add({ days: 1 })
        .toZonedDateTime(zone)
        .subtract({ seconds: 1 })
        .toInstant()
        .toString();
    }
  }
}

/** The calendar day an UNTIL value falls on, in the zone the series is shown in. */
function dayOfUntil(until: ICAL.Time, start: TemporalValue, deviceZone: string): string {
  const value = until.toString();
  if (until.isDate || !value.endsWith('Z')) {
    return value.slice(0, 10);
  }

  const zone = start.kind === 'zoned' ? (start.timeZone ?? deviceZone) : deviceZone;
  return Temporal.Instant.from(value).toZonedDateTimeISO(zone).toPlainDate().toString();
}
