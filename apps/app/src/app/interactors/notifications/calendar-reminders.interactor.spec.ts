import { TestBed } from '@angular/core/testing';

import { NotificationPreferencesStore } from '@app/data/stores/notification-preferences.store';
import {
  CalendarFiltersInteractor,
  type CalendarFilterOption,
} from '@app/interactors/calendar/calendar-filters.interactor';

import { CalendarRemindersInteractor } from './calendar-reminders.interactor';
import { ReminderSchedulerInteractor } from './reminder-scheduler.interactor';

const APP: CalendarFilterOption = {
  id: 'app-cal',
  name: 'Mein Kalender',
  color: null,
  emoji: null,
  sourceType: 'app',
};
const GOOGLE: CalendarFilterOption = {
  id: 'device-cal:google',
  name: 'Google',
  color: null,
  emoji: null,
  sourceType: 'device',
};
const FEED: CalendarFilterOption = {
  id: 'ics-cal:feed',
  name: 'Feiertage',
  color: null,
  emoji: null,
  sourceType: 'ics',
};

class FakeScheduler {
  reschedules = 0;

  reschedule(): Promise<void> {
    this.reschedules += 1;
    return Promise.resolve();
  }
}

describe('CalendarRemindersInteractor', () => {
  let scheduler: FakeScheduler;

  beforeEach(() => {
    localStorage.clear();
    scheduler = new FakeScheduler();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: ReminderSchedulerInteractor, useValue: scheduler },
        {
          provide: CalendarFiltersInteractor,
          useValue: { listFilterable: () => Promise.resolve([APP, GOOGLE, FEED]) },
        },
      ],
    });
  });

  it('lists the calendars in chip order', async () => {
    await expect(TestBed.inject(CalendarRemindersInteractor).list()).resolves.toEqual([
      APP,
      GOOGLE,
      FEED,
    ]);
  });

  it('reminds of the app calendar by default, but not of device or subscribed calendars', () => {
    const interactor = TestBed.inject(CalendarRemindersInteractor);

    expect([APP, GOOGLE, FEED].map((calendar) => interactor.reminds(calendar))).toEqual([
      true,
      false,
      false,
    ]);
  });

  it('keeps a switch per calendar and reschedules after each change', () => {
    const interactor = TestBed.inject(CalendarRemindersInteractor);

    interactor.setReminds(GOOGLE.id, true);
    interactor.setReminds(APP.id, false);

    expect([APP, GOOGLE, FEED].map((calendar) => interactor.reminds(calendar))).toEqual([
      false,
      true,
      false,
    ]);
    expect(TestBed.inject(NotificationPreferencesStore).preferences().calendarReminders).toEqual({
      'device-cal:google': true,
      'app-cal': false,
    });
    expect(scheduler.reschedules).toBe(2);
  });
});
