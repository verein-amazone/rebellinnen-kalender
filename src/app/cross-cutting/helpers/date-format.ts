import { formatDate, registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';

/**
 * German date labels, built on Angular's own formatting mechanism (`formatDate`, the function
 * behind `DatePipe`) so TS-composed labels and template pipes can never disagree. Templates that
 * format a single value use `DatePipe` directly; these helpers exist for labels that are composed
 * in code — grid cell names, live-region announcements, the period header.
 *
 * The UI language is German regardless of the device locale, so the locale is pinned rather than
 * injected. Registered here as well as in `app.config.ts`, because the helpers must work wherever
 * they are imported — including specs that never build the application config.
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

/** `2026-08-15` → „August 2026". */
export function formatMonthYear(day: string): string {
  return formatDate(day, 'MMMM y', LOCALE);
}

/**
 * A week's header label. Inside one month the month is named once („3.–9. August 2026"); across a
 * month or year boundary both ends are dated in short form.
 */
export function formatWeekRangeLabel(fromDay: string, toDay: string): string {
  const [fromYear, fromMonth] = fromDay.split('-');
  const [toYear, toMonth] = toDay.split('-');

  if (fromYear === toYear && fromMonth === toMonth) {
    return `${formatDate(fromDay, 'd', LOCALE)}.–${formatDate(toDay, 'd', LOCALE)}. ${formatMonthYear(toDay)}`;
  }

  const crossesYear = fromYear !== toYear;

  return `${formatDate(fromDay, crossesYear ? 'd. MMM y' : 'd. MMM', LOCALE)} – ${formatDate(toDay, 'd. MMM y', LOCALE)}`;
}

/**
 * The wall-clock time („09:30", the predefined `shortTime` format) of a UTC instant. Formats in the
 * device zone by default; `timeZone` takes what `DatePipe` takes — an offset such as `'+0200'` —
 * and exists for deterministic tests.
 */
export function formatTimeOfDay(utcInstant: string, timeZone?: string): string {
  return formatDate(utcInstant, 'shortTime', LOCALE, timeZone);
}
