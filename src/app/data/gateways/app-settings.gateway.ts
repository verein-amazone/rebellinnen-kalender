import { inject, Injectable } from '@angular/core';
import { AndroidSettings, IOSSettings } from 'capacitor-native-settings';

import { NATIVE_SETTINGS } from './native-settings';

/**
 * The deep link into this app's own OS settings screen - the only importer of
 * `capacitor-native-settings`. The permission-recovery flow uses this to send the user straight to
 * the calendar-permission toggle after a denied or revoked device-calendar connection; the app
 * cannot request the permission again on its own once the OS has recorded a denial.
 */
@Injectable({ providedIn: 'root' })
export class AppSettingsGateway {
  private readonly plugin = inject(NATIVE_SETTINGS);

  async openAppSettings(): Promise<void> {
    await this.plugin.open({
      optionAndroid: AndroidSettings.ApplicationDetails,
      optionIOS: IOSSettings.App,
    });
  }
}
