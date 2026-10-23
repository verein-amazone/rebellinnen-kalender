import { Temporal } from 'temporal-polyfill';

import type { ContentItemRecord } from '@app/data/entities/content-item.record';

/** The two bounds of an item's eligible window, as `ContentItemRecord` carries them. */
export type ContentWindow = Pick<ContentItemRecord, 'validFrom' | 'validTo'>;

/**
 * Content with no `validFrom`/`validTo` bound (or open-ended on one side) is treated as if it were
 * eligible for this many days, when computing its selection weight - long enough that it's clearly
 * less urgent than a dated item, without ever reaching zero probability.
 */
export const EVERGREEN_WINDOW_DAYS = 90;

/** The prefix of a yearly bound: `--MM-DD`, ISO 8601's month-day without a year. */
const YEARLY_PREFIX = '--';

/**
 * Whether `today` (`YYYY-MM-DD`) falls inside an item's window.
 *
 * A window is one of:
 * - evergreen: both bounds `null`;
 * - one-off: `YYYY-MM-DD` bounds, either of which may be `null` to leave that side open;
 * - yearly: `--MM-DD` bounds, both set, recurring every year. A yearly window whose start lies after
 *   its end wraps the turn of the year (`--12-20` to `--01-06`).
 *
 * A window that mixes the two forms, or a yearly one with only one bound, matches no day: it is a
 * catalog mistake, and `content-catalog.content.spec.ts` rejects it before it ships.
 */
export function isWithinWindow(window: ContentWindow, today: string): boolean {
  const { validFrom, validTo } = window;

  if (isYearly(validFrom) || isYearly(validTo)) {
    if (validFrom === null || validTo === null || !isYearly(validFrom) || !isYearly(validTo)) {
      return false;
    }
    // Zero-padded `--MM-DD` strings sort like the dates they name, the same reason the one-off
    // bounds below can be compared as plain strings.
    const monthDay = `${YEARLY_PREFIX}${today.slice(5)}`;
    return validFrom <= validTo
      ? validFrom <= monthDay && monthDay <= validTo
      : monthDay >= validFrom || monthDay <= validTo;
  }

  return (validFrom === null || validFrom <= today) && (validTo === null || validTo >= today);
}

/**
 * How many days an item is eligible for - narrower windows get picked more often. A yearly window is
 * measured within one year, `today`'s, so a wrapped window counts the days across the turn of the
 * year and a `--02-29` bound falls back to the 28th outside leap years.
 */
export function windowDays(window: ContentWindow, today: string): number {
  const { validFrom, validTo } = window;
  if (validFrom === null || validTo === null) {
    return EVERGREEN_WINDOW_DAYS;
  }

  if (isYearly(validFrom) && isYearly(validTo)) {
    const year = Temporal.PlainDate.from(today).year;
    const start = Temporal.PlainMonthDay.from(validFrom).toPlainDate({ year });
    const endYear = validFrom <= validTo ? year : year + 1;
    const end = Temporal.PlainMonthDay.from(validTo).toPlainDate({ year: endYear });
    return Math.max(1, start.until(end).days + 1);
  }

  if (isYearly(validFrom) || isYearly(validTo)) {
    return EVERGREEN_WINDOW_DAYS;
  }

  const spanDays = Temporal.PlainDate.from(validFrom).until(validTo).days + 1;
  return Math.max(1, spanDays);
}

function isYearly(bound: string | null): boolean {
  return bound !== null && bound.startsWith(YEARLY_PREFIX);
}
