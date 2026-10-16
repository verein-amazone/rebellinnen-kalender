import { Temporal } from 'temporal-polyfill';

import {
  ALL_DAY_REMINDER_PRESETS,
  MAX_REMINDERS,
  TIMED_REMINDER_PRESETS,
} from '@app/data/stores/notification-preferences';

// The form and the settings author these, so they are part of the language views speak.
export { MAX_REMINDERS } from '@app/data/stores/notification-preferences';

export interface ReminderOption {
  readonly minutes: number;
  readonly label: string;
}

/** The presets a picker offers for a timed or an all-day appointment, in display order. */
export function reminderOptions(allDay: boolean): ReminderOption[] {
  const presets: readonly number[] = allDay ? ALL_DAY_REMINDER_PRESETS : TIMED_REMINDER_PRESETS;
  return presets.map((minutes) => ({ minutes, label: reminderLabel(minutes, allDay) }));
}

/**
 * „15 Minuten vorher“, „1 Tag vorher um 09:00“. Any whole number of minutes gets a label, not only
 * the presets, so a reminder that came from elsewhere - or a timed list kept on an appointment that
 * became all-day - still reads sensibly.
 */
export function reminderLabel(minutes: number, allDay: boolean): string {
  return allDay ? allDayLabel(minutes) : timedLabel(minutes);
}

function timedLabel(minutes: number): string {
  if (minutes === 0) {
    return 'Zum Terminbeginn';
  }
  if (minutes < 0) {
    return `${amount(-minutes)} nach Beginn`;
  }
  return `${amount(minutes)} vorher`;
}

function allDayLabel(minutes: number): string {
  // Minutes before midnight of the first day: 900 is 15 hours before, i.e. 09:00 the day before.
  const daysBefore = Math.ceil(minutes / 1440);
  const minuteOfDay = daysBefore * 1440 - minutes;
  const time = Temporal.PlainTime.from({ hour: 0 })
    .add({ minutes: minuteOfDay })
    .toString({ smallestUnit: 'minute' });

  if (daysBefore <= 0) {
    return `Am Tag um ${time}`;
  }
  if (daysBefore === 7) {
    return `1 Woche vorher um ${time}`;
  }
  return `${daysBefore === 1 ? '1 Tag' : `${daysBefore} Tage`} vorher um ${time}`;
}

function amount(minutes: number): string {
  if (minutes % 10080 === 0) {
    const weeks = minutes / 10080;
    return weeks === 1 ? '1 Woche' : `${weeks} Wochen`;
  }
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return days === 1 ? '1 Tag' : `${days} Tage`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? '1 Stunde' : `${hours} Stunden`;
  }
  return minutes === 1 ? '1 Minute' : `${minutes} Minuten`;
}

/** Whether another reminder fits into a list. */
export function canAddReminder(reminders: readonly number[]): boolean {
  return reminders.length < MAX_REMINDERS;
}
