import { computed, inject, Injectable } from '@angular/core';

import { remindsOfCalendar } from '@app/data/stores/notification-preferences';
import { NotificationPreferencesStore } from '@app/data/stores/notification-preferences.store';
import {
  CalendarFiltersInteractor,
  type CalendarFilterOption,
} from '@app/interactors/calendar/calendar-filters.interactor';

import { ReminderSchedulerInteractor } from './reminder-scheduler.interactor';

/**
 * Which calendars the app reminds of (#81): „Kalender verwalten → Erinnerungen“.
 *
 * The app's own calendars remind by default; a device or subscribed calendar only once the user
 * turns it on - for example a Google calendar synced through the OS whose own notifications are
 * off. A synced appointment then reminds at its own alerts, else at the default times. Every change
 * reschedules the pending notifications.
 */
@Injectable({ providedIn: 'root' })
export class CalendarRemindersInteractor {
  private readonly store = inject(NotificationPreferencesStore);
  private readonly calendars = inject(CalendarFiltersInteractor);
  private readonly scheduler = inject(ReminderSchedulerInteractor);

  /** Whether reminders are on at all - without that, the switches here schedule nothing. */
  readonly enabled = computed(() => this.store.preferences().enabled);

  /** Every calendar that can show appointments, in the order of the Kalender screen's chips. */
  list(): Promise<CalendarFilterOption[]> {
    return this.calendars.listFilterable();
  }

  /** Reads the store's signal, so a template calling it follows a change at once. */
  reminds(calendar: CalendarFilterOption): boolean {
    return remindsOfCalendar(this.store.preferences(), calendar);
  }

  setReminds(calendarId: string, reminds: boolean): void {
    this.store.update({
      calendarReminders: { ...this.store.preferences().calendarReminders, [calendarId]: reminds },
    });
    void this.scheduler.reschedule();
  }
}
