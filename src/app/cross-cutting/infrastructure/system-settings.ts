import { inject, Injectable } from '@angular/core';

import {
  AndroidSettings,
  IOSSettings,
  NATIVE_SETTINGS,
} from '@app/cross-cutting/plugins/native-settings.plugin';

/**
 * The deep link into this app's own OS settings screen, wrapping `capacitor-native-settings`
 * (see `../plugins/native-settings.plugin.ts`). The permission-recovery flow uses this to send the user straight to
 * the calendar-permission toggle after a denied or revoked device-calendar connection; the app
 * cannot request the permission again on its own once the OS has recorded a denial.
 */
@Injectable({ providedIn: 'root' })
export class SystemSettings {
  private readonly plugin = inject(NATIVE_SETTINGS);

  async openAppSettings(): Promise<void> {
    await this.plugin.open({
      optionAndroid: AndroidSettings.ApplicationDetails,
      optionIOS: IOSSettings.App,
    });
  }
}
