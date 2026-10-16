import type { CalendarOccurrence } from '@app/interactors/calendar/calendar-occurrence.vm';

/** How many of today's appointments the Today page lists; „Alle Termine“ leads to the rest. */
export const UPCOMING_APPOINTMENT_LIMIT = 3;

/**
 * Today's appointments that are still ahead or under way, at most `limit` of them, in the order
 * given (the interactor's: all-day entries first, then by start time).
 *
 * An all-day entry stays in for the whole day: it has no clock time to be over by. A timed entry
 * drops out once it has ended, not once it has started, so the meeting the user is sitting in is
 * still on the list.
 *
 * Pure on purpose, like `selectTodayClosingState`: the caller supplies `nowUtc`, so a test never
 * has to mock a clock.
 */
export function selectUpcomingAppointments(
  todayOccurrences: readonly CalendarOccurrence[],
  nowUtc: string,
  limit: number = UPCOMING_APPOINTMENT_LIMIT,
): readonly CalendarOccurrence[] {
  return todayOccurrences
    .filter((occurrence) => occurrence.allDay || occurrence.endUtc > nowUtc)
    .slice(0, limit);
}
