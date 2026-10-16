import { InjectionToken } from '@angular/core';
import type { PluginListenerHandle } from '@capacitor/core';
import {
  LocalNotifications,
  type ActionPerformed,
  type CancelOptions,
  type PendingResult,
  type PermissionStatus,
  type ScheduleOptions,
  type ScheduleResult,
  type SettingsPermissionStatus,
} from '@capacitor/local-notifications';

/** The slice of the local-notifications plugin this app uses. */
export interface LocalNotificationsPlugin {
  checkPermissions(): Promise<PermissionStatus>;
  requestPermissions(): Promise<PermissionStatus>;
  checkExactNotificationSetting(): Promise<SettingsPermissionStatus>;
  schedule(options: ScheduleOptions): Promise<ScheduleResult>;
  getPending(): Promise<PendingResult>;
  cancel(options: CancelOptions): Promise<void>;
  addListener(
    eventName: 'localNotificationActionPerformed',
    listener: (action: ActionPerformed) => void,
  ): Promise<PluginListenerHandle>;
}

/**
 * The local-notifications plugin, for appointment reminders (#81). See ./README.md for why it is
 * behind a token.
 *
 * Handed on as a plain object rather than the plugin itself, like `CAPACITOR_APP`: a Capacitor
 * plugin proxy answers *every* property, so Angular's DI would see an `ngOnDestroy` on it.
 */
export const LOCAL_NOTIFICATIONS = new InjectionToken<LocalNotificationsPlugin>(
  'LOCAL_NOTIFICATIONS',
  {
    providedIn: 'root',
    factory: () => ({
      checkPermissions: () => LocalNotifications.checkPermissions(),
      requestPermissions: () => LocalNotifications.requestPermissions(),
      checkExactNotificationSetting: () => LocalNotifications.checkExactNotificationSetting(),
      schedule: (options) => LocalNotifications.schedule(options),
      getPending: () => LocalNotifications.getPending(),
      cancel: (options) => LocalNotifications.cancel(options),
      addListener: (eventName, listener) => LocalNotifications.addListener(eventName, listener),
    }),
  },
);
