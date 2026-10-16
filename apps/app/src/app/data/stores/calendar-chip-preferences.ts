/**
 * How the Kalender screen's source-filter chips are presented.
 *
 * Both values are lists of calendar ids, and both are the user's own arrangement of the chip row
 * rather than configuration of the calendars themselves: a hidden calendar is still connected and
 * still syncs, and the order here changes nothing about the data. Disconnecting a calendar is a
 * different decision and lives in the settings (`calendars.enabled`), which removes its chip
 * altogether.
 *
 * Ids of calendars that are gone are simply never matched again, so no cleanup pass is needed.
 */
export interface CalendarChipPreferences {
  /** Calendars whose occurrences the Kalender screen leaves out. Heute is deliberately unfiltered. */
  readonly hiddenCalendarIds: readonly string[];
  /** The chip order the user arranged. Calendars not in it follow, in the default order. */
  readonly calendarOrder: readonly string[];
}

/**
 * Bounds each list, so a corrupted or hand-edited entry cannot grow without limit. Well above any
 * plausible number of calendars on one device.
 */
export const MAX_STORED_CALENDAR_IDS = 200;

export const DEFAULT_CALENDAR_CHIP_PREFERENCES: CalendarChipPreferences = {
  hiddenCalendarIds: [],
  calendarOrder: [],
};

/**
 * Where a calendar sits in the user's arranged order - `Number.MAX_SAFE_INTEGER` for one they
 * never placed, so it sorts after everything they did.
 *
 * Returned as a lookup rather than applied here, because each list decides for itself what to do
 * with the rest: the chip row falls back to its own default rule, the appointment picker keeps the
 * database order it already had. Both sort stably, so unplaced calendars keep their relative order.
 */
export function placementRank(order: readonly string[]): (calendarId: string) => number {
  const placedAt = new Map(order.map((id, index) => [id, index]));
  return (calendarId) => placedAt.get(calendarId) ?? Number.MAX_SAFE_INTEGER;
}
