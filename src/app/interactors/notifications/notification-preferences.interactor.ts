import { computed, inject, Injectable, Injector } from '@angular/core';

import {
  DeviceNotifications,
  type NotificationPermission,
} from '@app/cross-cutting/infrastructure/notifications';
import { SystemSettings } from '@app/cross-cutting/infrastructure/system-settings';
import { normalizedReminders } from '@app/data/stores/notification-preferences';
import { NotificationPreferencesStore } from '@app/data/stores/notification-preferences.store';

import { ReminderSchedulerInteractor } from './reminder-scheduler.interactor';

export type { NotificationPermission } from '@app/cross-cutting/infrastructure/notifications';

/**
 * The reminder settings (#81): the switch for reminders as a whole, and the default reminders a new
 * appointment starts with. Every change reschedules the pending notifications.
 *
 * Turning reminders on is the one place the app asks for the notification permission - from the
 * settings switch or the introduction, always in response to a tap. If the user declines, the
 * switch stays off; the settings then point to the system settings, since the OS will not ask a
 * second time.
 */
@Injectable({ providedIn: 'root' })
export class NotificationPreferencesInteractor {
  private readonly store = inject(NotificationPreferencesStore);
  private readonly notifications = inject(DeviceNotifications);
  // The scheduler and the OS settings are resolved on demand: every screen with an appointment form
  // reads the preferences, and neither the calendar data nor the settings plugin is needed for that.
  private readonly injector = inject(Injector);

  /** `false` on the web, which cannot deliver a reminder while the app is closed. */
  readonly isSupported = this.notifications.isSupported();

  readonly enabled = computed(() => this.store.preferences().enabled);
  readonly timedDefaults = computed(() => this.store.preferences().timedDefaults);
  readonly allDayDefaults = computed(() => this.store.preferences().allDayDefaults);

  permission(): Promise<NotificationPermission> {
    return this.notifications.permission();
  }

  /**
   * Turns reminders on (asking for the permission when needed) or off. Resolves to the permission
   * afterwards; reminders only end up on when it is granted.
   */
  async setEnabled(enabled: boolean): Promise<NotificationPermission> {
    if (!enabled) {
      this.store.update({ enabled: false });
      await this.scheduler().reschedule();
      return this.notifications.permission();
    }

    const current = await this.notifications.permission();
    const permission =
      current === 'prompt' ? await this.notifications.requestPermission() : current;
    this.store.update({ enabled: permission === 'granted' });
    await this.scheduler().reschedule();
    return permission;
  }

  setDefaults(kind: 'timed' | 'allDay', reminders: readonly number[]): void {
    this.store.update(
      kind === 'timed'
        ? { timedDefaults: normalizedReminders(reminders) }
        : { allDayDefaults: normalizedReminders(reminders) },
    );
    void this.scheduler().reschedule();
  }

  private scheduler(): ReminderSchedulerInteractor {
    return this.injector.get(ReminderSchedulerInteractor);
  }

  openSystemSettings(): Promise<void> {
    return this.injector.get(SystemSettings).openNotificationSettings();
  }
}
