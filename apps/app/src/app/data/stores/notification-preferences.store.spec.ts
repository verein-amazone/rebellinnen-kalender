import { TestBed } from '@angular/core/testing';

import { NotificationPreferencesStore } from './notification-preferences.store';

const STORAGE_KEY = 'rk.notifications';

describe('NotificationPreferencesStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('starts switched off, with 15 minutes and the day before at 09:00 as defaults', () => {
    expect(TestBed.inject(NotificationPreferencesStore).preferences()).toEqual({
      enabled: false,
      timedDefaults: [15],
      allDayDefaults: [900],
      calendarReminders: {},
    });
  });

  it('persists and restores an update', () => {
    TestBed.inject(NotificationPreferencesStore).update({
      enabled: true,
      timedDefaults: [60, 0],
      calendarReminders: { 'device-cal:1': true },
    });

    TestBed.resetTestingModule();
    expect(TestBed.inject(NotificationPreferencesStore).preferences()).toEqual({
      enabled: true,
      timedDefaults: [60, 0],
      allDayDefaults: [900],
      calendarReminders: { 'device-cal:1': true },
    });
  });

  it('falls back field by field for malformed values', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        enabled: 'yes',
        timedDefaults: ['15'],
        allDayDefaults: [900, 900, -540],
        calendarReminders: { 'device-cal:1': true, 'ics-cal:2': 'yes' },
      }),
    );

    expect(TestBed.inject(NotificationPreferencesStore).preferences()).toEqual({
      enabled: false,
      timedDefaults: [15],
      allDayDefaults: [900, -540],
      calendarReminders: { 'device-cal:1': true },
    });
  });
});
