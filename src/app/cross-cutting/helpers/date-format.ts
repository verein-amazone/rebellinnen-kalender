import { formatDate, registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { Temporal } from 'temporal-polyfill';

/**
 * German date labels, built on Angular's own formatting mechanism (`formatDate`, the function
 * behind `DatePipe`) so TS-composed labels and template pipes can never disagree. Templates that
 * format a single value use `DatePipe` directly; these helpers exist for labels that are composed
 * in code - grid cell names, live-region announcements, the period header.
 *
 * The UI language is German regardless of the device locale, so the locale is pinned rather than
 * injected. Registered here as well as in `app.config.ts`, because the helpers must work wherever
 * they are imported - including specs that never build the application config.
 */
registerLocaleData(localeDe);

const LOCALE = 'de';

/** Monday-first weekday headers for calendar grids: visible short form plus the spoken full name. */
export const WEEKDAY_HEADERS: readonly { readonly short: string; readonly long: string }[] = [
  { short: 'Mo', long: 'Montag' },
  { short: 'Di', long: 'Dienstag' },
  { short: 'Mi', long: 'Mittwoch' },
  { short: 'Do', long: 'Donnerstag' },
  { short: 'Fr', long: 'Freitag' },
  { short: 'Sa', long: 'Samstag' },
  { short: 'So', long: 'Sonntag' },
];

/** `2026-08-03` → „Montag, 3. August 2026" (the predefined `fullDate` format). */
export function formatDayLong(day: string): string {
  return formatDate(day, 'fullDate', LOCALE);
}

/** `2026-08-03` → „Mo., 3. Aug.", for a day close enough that the year goes without saying. */
export function formatDayShort(day: string): string {
  return formatDate(day, 'EEE, d. MMM', LOCALE);
}

/** `2026-08-15` → „August 2026". */
export function formatMonthYear(day: string): string {
  return formatDate(day, 'MMMM y', LOCALE);
}

/**
 * A week's header label, from `Intl.DateTimeFormat#formatRange`, which leaves out what both ends
 * share. Inside one month the month is named once, in full („3.–9. August 2026"); across a month or
 * year boundary both ends are dated in short form („31. Aug. – 6. Sept. 2026").
 */
export function formatWeekRangeLabel(fromDay: string, toDay: string): string {
  const from = Temporal.PlainDate.from(fromDay);
  const to = Temporal.PlainDate.from(toDay);
  const sameMonth = from.year === to.year && from.month === to.month;
  return (sameMonth ? WEEK_RANGE_IN_MONTH : WEEK_RANGE_ACROSS_MONTHS).formatRange(
    atNoonUtc(from),
    atNoonUtc(to),
  );
}

const WEEK_RANGE_IN_MONTH = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const WEEK_RANGE_ACROSS_MONTHS = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** A day as a `Date` that is that day in UTC, the zone the range formats are pinned to. */
function atNoonUtc(day: Temporal.PlainDate): Date {
  return new Date(day.toZonedDateTime({ timeZone: 'UTC', plainTime: '12:00' }).epochMilliseconds);
}

/**
 * The wall-clock time („09:30", the predefined `shortTime` format) of a UTC instant. Formats in the
 * device zone by default; `timeZone` takes what `DatePipe` takes - an offset such as `'+0200'` -
 * and exists for deterministic tests.
 */
export function formatTimeOfDay(utcInstant: string, timeZone?: string): string {
  return formatDate(utcInstant, 'shortTime', LOCALE, timeZone);
}
