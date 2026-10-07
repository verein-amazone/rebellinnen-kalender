import { TestBed } from '@angular/core/testing';

import {
  DeviceNotifications,
  type NotificationPermission,
} from '@app/cross-cutting/infrastructure/notifications';

import { NotificationPreferencesInteractor } from './notification-preferences.interactor';
import { ReminderSchedulerInteractor } from './reminder-scheduler.interactor';

class FakeNotifications {
  current: NotificationPermission = 'prompt';
  answer: NotificationPermission = 'granted';
  requests = 0;

  isSupported(): boolean {
    return true;
  }

  permission(): Promise<NotificationPermission> {
    return Promise.resolve(this.current);
  }

  requestPermission(): Promise<NotificationPermission> {
    this.requests += 1;
    this.current = this.answer;
    return Promise.resolve(this.answer);
  }
}

class FakeScheduler {
  reschedules = 0;

  reschedule(): Promise<void> {
    this.reschedules += 1;
    return Promise.resolve();
  }
}

describe('NotificationPreferencesInteractor', () => {
  let notifications: FakeNotifications;
  let scheduler: FakeScheduler;

  beforeEach(() => {
    localStorage.clear();
    notifications = new FakeNotifications();
    scheduler = new FakeScheduler();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: DeviceNotifications, useValue: notifications },
        { provide: ReminderSchedulerInteractor, useValue: scheduler },
      ],
    });
  });

  it('asks for the permission when reminders are turned on, and reschedules', async () => {
    const preferences = TestBed.inject(NotificationPreferencesInteractor);

    await expect(preferences.setEnabled(true)).resolves.toBe('granted');

    expect(notifications.requests).toBe(1);
    expect(preferences.enabled()).toBe(true);
    expect(scheduler.reschedules).toBe(1);
  });

  it('stays off when the permission is declined', async () => {
    notifications.answer = 'denied';
    const preferences = TestBed.inject(NotificationPreferencesInteractor);

    await expect(preferences.setEnabled(true)).resolves.toBe('denied');

    expect(preferences.enabled()).toBe(false);
  });

  it('does not ask again once the OS has recorded a denial', async () => {
    notifications.current = 'denied';

    await TestBed.inject(NotificationPreferencesInteractor).setEnabled(true);

    expect(notifications.requests).toBe(0);
  });

  it('keeps at most five defaults, earliest reminder first', () => {
    const preferences = TestBed.inject(NotificationPreferencesInteractor);

    preferences.setDefaults('timed', [0, 15, 60, 5, 10, 30, 15]);

    expect(preferences.timedDefaults()).toEqual([60, 30, 15, 10, 5]);
  });
});
