import { Temporal } from 'temporal-polyfill';

/** An inclusive span of local days, both bounds `YYYY-MM-DD`. */
export interface DayRange {
  readonly fromDay: string;
  readonly toDay: string;
}

/** The Monday-to-Sunday week containing `day`. */
export function weekRange(day: string): DayRange {
  const date = Temporal.PlainDate.from(day);
  const monday = date.subtract({ days: date.dayOfWeek - 1 });

  return { fromDay: monday.toString(), toDay: monday.add({ days: 6 }).toString() };
}

/**
 * The full-week grid shown for `day`'s month: the Monday on or before the 1st through the Sunday on
 * or after the last day. Out-of-month cells at the edges are part of the range on purpose, so their
 * appointment indicators can be loaded together with the month's.
 */
export function monthGridRange(day: string): DayRange {
  const date = Temporal.PlainDate.from(day);
  const first = date.with({ day: 1 });
  const last = date.with({ day: date.daysInMonth });

  return { fromDay: weekRange(first.toString()).fromDay, toDay: weekRange(last.toString()).toDay };
}

/** Every day from `fromDay` through `toDay`, inclusive. */
export function daysInRange(fromDay: string, toDay: string): string[] {
  const days: string[] = [];
  let cursor = Temporal.PlainDate.from(fromDay);
  const end = Temporal.PlainDate.from(toDay);

  while (Temporal.PlainDate.compare(cursor, end) <= 0) {
    days.push(cursor.toString());
    cursor = cursor.add({ days: 1 });
  }

  return days;
}

export function addWeeks(day: string, weeks: number): string {
  return Temporal.PlainDate.from(day).add({ weeks }).toString();
}

/** Adding a month clamps to the target month's length: Aug 31 + 1 month = Sep 30. */
export function addMonths(day: string, months: number): string {
  return Temporal.PlainDate.from(day).add({ months }).toString();
}
