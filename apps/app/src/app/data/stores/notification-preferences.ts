/**
 * Persisted preferences of the appointment reminders (#81): whether they are on at all, and which
 * reminders a new appointment starts with - one list for timed appointments and one for all-day
 * ones, because „15 minutes before“ means nothing at midnight.
 *
 * A reminder is a number of minutes before the start. For an all-day appointment the start is
 * midnight of its first day, so „1 day before at 09:00“ is 900 (15 hours before midnight) and „on
 * the day at 09:00“ is -540.
 */

/** The choices for a timed appointment, mirroring the platform calendar apps. */
export const TIMED_REMINDER_PRESETS = [0, 5, 10, 15, 30, 60, 120, 1440, 2880, 10080] as const;

/** The choices for an all-day appointment, all at 09:00. */
export const ALL_DAY_REMINDER_PRESETS = [-540, 900, 2340, 9540] as const;

/** How many reminders one appointment (or one default list) can hold. */
export const MAX_REMINDERS = 5;

export interface NotificationPreferences {
  /** Off until the user turns reminders on, so nothing asks for a permission unprompted. */
  readonly enabled: boolean;
  readonly timedDefaults: readonly number[];
  readonly allDayDefaults: readonly number[];
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: false,
  timedDefaults: [15],
  allDayDefaults: [900],
};

/** At most `MAX_REMINDERS` whole minutes, without duplicates, earliest reminder first. */
export function normalizedReminders(reminders: readonly number[]): number[] {
  return [...new Set(reminders.filter((minutes) => Number.isInteger(minutes)))]
    .sort((a, b) => b - a)
    .slice(0, MAX_REMINDERS);
}
