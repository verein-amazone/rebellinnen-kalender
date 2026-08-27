import type { CalendarOccurrence } from '@app/interactors/calendar/calendar-occurrence.vm';

/**
 * Which of the Today page's closing states applies, ordered by priority: an earlier entry always
 * wins over a later one when its condition holds.
 */
export const TODAY_CLOSING_STATES = [
  'appointment-later',
  'open-reminders',
  'day-over',
  'all-done',
  'nothing-planned',
] as const;

export type TodayClosingStateId = (typeof TODAY_CLOSING_STATES)[number];

/**
 * The Today page's closing footer, reduced to what it needs to render: which state applies, the
 * message-key(s) to resolve into copy, and the occurrence(s) a supporting line refers to.
 *
 * Copy text is deliberately not part of this shape - `headlineKey`/`supportingLineKey` are looked
 * up in the copy pool separately, so the state-selection rules stay testable without depending on
 * exact wording.
 */
export interface TodayClosingState {
  readonly id: TodayClosingStateId;
  readonly headlineKey: string;
  readonly supportingLineKey: string | null;
  /** Set only for `appointment-later`: the appointment the supporting line refers to. */
  readonly nextAppointment: CalendarOccurrence | null;
  /** Set only when a tomorrow-preview supporting line was chosen. */
  readonly tomorrowAppointment: CalendarOccurrence | null;
  readonly openReminderCount: number;
}
