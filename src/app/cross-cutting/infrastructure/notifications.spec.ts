import { TestBed } from '@angular/core/testing';

import { LOCAL_NOTIFICATIONS } from '@app/cross-cutting/plugins/local-notifications.plugin';

import { DevicePlatformService } from './device-platform';
import { DeviceNotifications, type PlannedNotification } from './notifications';

interface ScheduledNotification {
  readonly id: number;
  readonly isExactNotification: boolean;
}

class FakeLocalNotifications {
  pending: number[] = [];
  exactAlarm: 'granted' | 'denied' | 'failing' = 'granted';
  failingSchedule = false;
  failingPending = false;
  scheduled: ScheduledNotification[] = [];
  cancelled: number[] = [];

  getPending(): Promise<{ notifications: { id: number }[] }> {
    if (this.failingPending) {
      return Promise.reject(new Error('no notification centre'));
    }
    return Promise.resolve({ notifications: this.pending.map((id) => ({ id })) });
  }

  cancel(options: { notifications: { id: number }[] }): Promise<void> {
    const ids = options.notifications.map(({ id }) => id);
    this.cancelled.push(...ids);
    this.pending = this.pending.filter((id) => !ids.includes(id));
    return Promise.resolve();
  }

  schedule(options: { notifications: ScheduledNotification[] }): Promise<void> {
    if (this.failingSchedule) {
      return Promise.reject(new Error('schedule failed'));
    }
    this.scheduled.push(...options.notifications);
    for (const { id } of options.notifications) {
      if (!this.pending.includes(id)) {
        this.pending.push(id);
      }
    }
    return Promise.resolve();
  }

  checkExactNotificationSetting(): Promise<{ exact_alarm: string }> {
    if (this.exactAlarm === 'failing') {
      return Promise.reject(new Error('not available'));
    }
    return Promise.resolve({ exact_alarm: this.exactAlarm });
  }
}

function planned(id: number): PlannedNotification {
  return {
    id,
    title: 'Zahnarzt',
    body: 'In 15 Minuten',
    atUtc: '2027-02-05T09:45:00Z',
    target: `occurrence-${id}`,
  };
}

function setup(platform: 'ios' | 'android' | 'web' = 'ios') {
  const plugin = new FakeLocalNotifications();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: LOCAL_NOTIFICATIONS, useValue: plugin },
      { provide: DevicePlatformService, useValue: { platform } },
    ],
  });
  return { notifications: TestBed.inject(DeviceNotifications), plugin };
}

describe('DeviceNotifications', () => {
  describe('replaceAll', () => {
    it('cancels only the pending notifications that are no longer planned', async () => {
      const { notifications, plugin } = setup();
      plugin.pending = [1, 2, 3];

      await notifications.replaceAll([planned(2), planned(3), planned(4)]);

      expect(plugin.cancelled).toEqual([1]);
      expect(plugin.scheduled.map(({ id }) => id)).toEqual([2, 3, 4]);
      expect(plugin.pending.sort()).toEqual([2, 3, 4]);
    });

    it('keeps the reminders that were already pending when scheduling fails, and says so', async () => {
      const { notifications, plugin } = setup();
      plugin.pending = [1, 2];
      plugin.failingSchedule = true;

      await expect(notifications.replaceAll([planned(1), planned(2)])).rejects.toThrow(
        'schedule failed',
      );

      expect(plugin.cancelled).toEqual([]);
      expect(plugin.pending).toEqual([1, 2]);
    });

    it('cancels everything and schedules nothing for an empty plan', async () => {
      const { notifications, plugin } = setup();
      plugin.pending = [1, 2];

      await notifications.replaceAll([]);

      expect(plugin.cancelled).toEqual([1, 2]);
      expect(plugin.scheduled).toEqual([]);
    });

    it('schedules exactly on iOS', async () => {
      const { notifications, plugin } = setup('ios');

      await notifications.replaceAll([planned(1)]);

      expect(plugin.scheduled[0].isExactNotification).toBe(true);
    });

    it('falls back to inexact delivery on Android without the exact-alarm grant', async () => {
      const { notifications, plugin } = setup('android');
      plugin.exactAlarm = 'denied';

      await notifications.replaceAll([planned(1)]);

      expect(plugin.scheduled[0].isExactNotification).toBe(false);
    });

    it('falls back to inexact delivery on Android when the grant cannot be read', async () => {
      const { notifications, plugin } = setup('android');
      plugin.exactAlarm = 'failing';

      await notifications.replaceAll([planned(1)]);

      expect(plugin.scheduled[0].isExactNotification).toBe(false);
    });

    it('schedules exactly on Android with the exact-alarm grant', async () => {
      const { notifications, plugin } = setup('android');

      await notifications.replaceAll([planned(1)]);

      expect(plugin.scheduled[0].isExactNotification).toBe(true);
    });

    it('does nothing on the web', async () => {
      const { notifications, plugin } = setup('web');
      plugin.pending = [1];

      await notifications.replaceAll([planned(2)]);

      expect(plugin.cancelled).toEqual([]);
      expect(plugin.scheduled).toEqual([]);
    });
  });

  describe('cancelAll', () => {
    it('cancels every pending notification', async () => {
      const { notifications, plugin } = setup();
      plugin.pending = [1, 2];

      await notifications.cancelAll();

      expect(plugin.cancelled).toEqual([1, 2]);
    });

    it('swallows a failing device, so clearing the app data still goes on', async () => {
      const { notifications, plugin } = setup();
      plugin.failingPending = true;

      await expect(notifications.cancelAll()).resolves.toBeUndefined();
    });
  });
});
