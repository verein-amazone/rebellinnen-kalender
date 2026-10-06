import { inject, Injectable } from '@angular/core';

import { DevicePlatformService } from '@app/cross-cutting/infrastructure/device-platform';
import { LOCAL_NOTIFICATIONS } from '@app/cross-cutting/plugins/local-notifications.plugin';

/** Whether the app may post notifications - plugin-free. */
export type NotificationPermission = 'granted' | 'denied' | 'prompt';

/** One notification the app wants delivered at a fixed instant. */
export interface PlannedNotification {
  /** A 32-bit integer, unique among everything pending. */
  readonly id: number;
  readonly title: string;
  readonly body: string;
  readonly atUtc: string;
  /** Handed back when the notification is tapped. */
  readonly target: string;
}

/**
 * Local notifications on the device, wrapping `@capacitor/local-notifications` (see
 * `../plugins/local-notifications.plugin.ts`).
 *
 * Only the iOS and Android apps deliver them: a browser cannot wake a closed tab, so the web build
 * reports itself as unsupported and every call is a no-op there. Failures are swallowed like in
 * `DeviceHaptics` - a reminder that could not be scheduled must never break saving an appointment.
 */
@Injectable({ providedIn: 'root' })
export class DeviceNotifications {
  private readonly plugin = inject(LOCAL_NOTIFICATIONS);
  private readonly platform = inject(DevicePlatformService);

  isSupported(): boolean {
    return this.platform.platform !== 'web';
  }

  async permission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      return 'denied';
    }
    try {
      return toPermission((await this.plugin.checkPermissions()).display);
    } catch {
      return 'denied';
    }
  }

  /** Shows the OS prompt when it still can; only ever called from an explicit user action. */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      return 'denied';
    }
    try {
      return toPermission((await this.plugin.requestPermissions()).display);
    } catch {
      return 'denied';
    }
  }

  /**
   * Makes `planned` the complete set of pending notifications: everything else this app had
   * scheduled is cancelled. The caller has checked the permission - `schedule()` would otherwise
   * ask for it, and this runs in the background on every start.
   */
  async replaceAll(planned: readonly PlannedNotification[]): Promise<void> {
    if (!this.isSupported()) {
      return;
    }
    try {
      await this.cancelPending();
      if (planned.length === 0) {
        return;
      }

      // Without the exact-alarm grant the plugin would open the system settings on every schedule
      // call. Inexact delivery is the better fallback for a reminder made in the background.
      const exact = await this.canScheduleExactly();
      await this.plugin.schedule({
        notifications: planned.map((notification) => ({
          id: notification.id,
          title: notification.title,
          body: notification.body,
          schedule: { at: new Date(notification.atUtc), allowWhileIdle: true },
          extra: { target: notification.target },
          isExactNotification: exact,
        })),
      });
    } catch {
      // See the class comment.
    }
  }

  async cancelAll(): Promise<void> {
    if (!this.isSupported()) {
      return;
    }
    try {
      await this.cancelPending();
    } catch {
      // See the class comment.
    }
  }

  /**
   * Calls `handler` with the `target` of a tapped notification, including the one that launched
   * the app: the plugin keeps that event until a listener is registered.
   */
  onTapped(handler: (target: string) => void): void {
    if (!this.isSupported()) {
      return;
    }
    void this.plugin
      .addListener('localNotificationActionPerformed', (action) => {
        const target: unknown = action.notification.extra?.target;
        if (typeof target === 'string') {
          handler(target);
        }
      })
      .catch(() => undefined);
  }

  private async cancelPending(): Promise<void> {
    const { notifications } = await this.plugin.getPending();
    if (notifications.length > 0) {
      await this.plugin.cancel({ notifications: notifications.map(({ id }) => ({ id })) });
    }
  }

  private async canScheduleExactly(): Promise<boolean> {
    if (this.platform.platform !== 'android') {
      return true;
    }
    try {
      return (await this.plugin.checkExactNotificationSetting()).exact_alarm === 'granted';
    } catch {
      return false;
    }
  }
}

function toPermission(state: string): NotificationPermission {
  switch (state) {
    case 'granted':
      return 'granted';
    case 'denied':
      return 'denied';
    default:
      return 'prompt';
  }
}
