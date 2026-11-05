import { normalizedReminders } from '../stores/notification-preferences';

/**
 * A synced event's own reminders - a device event's alerts, an ICS event's `VALARM`s - in the form
 * the scheduler reads: at most `MAX_REMINDERS` whole minutes before the start, earliest first, or
 * `null` when there are none, which means „remind at the default times“. Unlike an app item, a
 * synced event cannot say „explicitly no reminder“: the calendar it comes from only lists the
 * alerts it has.
 */
export function syncedReminders(minutesBefore: readonly number[]): readonly number[] | null {
  const reminders = normalizedReminders(minutesBefore);
  return reminders.length === 0 ? null : reminders;
}
