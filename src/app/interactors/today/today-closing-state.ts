import type { CalendarOccurrence } from '@app/interactors/calendar/calendar-occurrence.vm';
import type { Reminder } from '@app/interactors/reminders/reminder.vm';

import type { TodayClosingState } from './today-closing-state.vm';

/** After this hour (device-zone, derived from `today`) the closing message switches to its night tone. */
const EVENING_HOUR = 20;

export interface TodayClosingStateInput {
  readonly reminders: readonly Reminder[];
  readonly todayOccurrences: readonly CalendarOccurrence[];
  readonly tomorrowOccurrences: readonly CalendarOccurrence[];
  readonly today: string;
  readonly nowUtc: string;
}

/**
 * Picks the Today page's closing state from the day's reminders and appointments.
 *
 * Pure and stateless on purpose: the block that calls this supplies `nowUtc` explicitly, so a test
 * never has to mock a clock, and the result is exactly reproducible from its inputs.
 *
 * Priority follows the issue's invariant — the page must never say the day is done while an open
 * reminder or a still-upcoming appointment exists — so those two are checked first, ahead of every
 * "everything is settled" state.
 */
export function selectTodayClosingState(input: TodayClosingStateInput): TodayClosingState {
  const { reminders, todayOccurrences, tomorrowOccurrences, today, nowUtc } = input;

  const openReminderCount = reminders.filter((reminder) => !reminder.completed).length;
  const nextAppointment =
    todayOccurrences.find((occurrence) => isFuture(occurrence, today, nowUtc)) ?? null;
  const tomorrowAppointment = tomorrowOccurrences[0] ?? null;

  if (nextAppointment !== null) {
    // Mixed with open reminders: the headline leads with the reminder count and the appointment
    // moves to the supporting line, matching the issue's own mixed-state example — never both
    // facts crammed into the headline, and never the reminder left unmentioned.
    return {
      id: 'appointment-later',
      headlineKey:
        openReminderCount === 0
          ? 'appointment-later.headline'
          : openReminderCount === 1
            ? 'open-reminders.headline.one'
            : 'open-reminders.headline.many',
      supportingLineKey: appointmentSupportingLineKey(openReminderCount, nextAppointment.allDay),
      nextAppointment,
      tomorrowAppointment: null,
      openReminderCount,
    };
  }

  if (openReminderCount > 0) {
    return {
      id: 'open-reminders',
      headlineKey:
        openReminderCount === 1 ? 'open-reminders.headline.one' : 'open-reminders.headline.many',
      supportingLineKey: 'open-reminders.supporting',
      nextAppointment: null,
      tomorrowAppointment: null,
      openReminderCount,
    };
  }

  if (isEvening(nowUtc)) {
    return {
      id: 'day-over',
      headlineKey: 'day-over.headline',
      supportingLineKey: 'day-over.goodnight',
      nextAppointment: null,
      tomorrowAppointment: null,
      openReminderCount,
    };
  }

  if (todayOccurrences.length > 0 || reminders.length > 0) {
    return {
      id: 'all-done',
      headlineKey: 'all-done.headline',
      supportingLineKey: tomorrowPreviewKey('all-done', tomorrowAppointment),
      nextAppointment: null,
      tomorrowAppointment,
      openReminderCount,
    };
  }

  return {
    id: 'nothing-planned',
    headlineKey: 'nothing-planned.headline',
    supportingLineKey: tomorrowPreviewKey('nothing-planned', tomorrowAppointment),
    nextAppointment: null,
    tomorrowAppointment,
    openReminderCount,
  };
}

function isFuture(occurrence: CalendarOccurrence, today: string, nowUtc: string): boolean {
  return occurrence.allDay ? occurrence.endDay >= today : occurrence.endUtc > nowUtc;
}

/**
 * Which supporting-line key states the next appointment's time — separate all-day variants exist
 * because an all-day appointment has no clock time to state ("beginnt um 00:00" would be wrong).
 */
function appointmentSupportingLineKey(openReminderCount: number, allDay: boolean): string {
  if (openReminderCount > 0) {
    return allDay ? 'appointment-later.withRemindersAllDay' : 'appointment-later.withReminders';
  }

  return allDay ? 'appointment-later.nextAllDay' : 'appointment-later.next';
}

function tomorrowPreviewKey(
  state: 'all-done' | 'nothing-planned',
  tomorrowAppointment: CalendarOccurrence | null,
): string | null {
  if (tomorrowAppointment === null) {
    return null;
  }

  return tomorrowAppointment.allDay ? `${state}.tomorrowPreviewAllDay` : `${state}.tomorrowPreview`;
}

/** Device-zone hour of `nowUtc`, past which the closing tone switches to night. */
function isEvening(nowUtc: string): boolean {
  return new Date(nowUtc).getHours() >= EVENING_HOUR;
}
