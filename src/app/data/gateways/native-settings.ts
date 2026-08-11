import { InjectionToken } from '@angular/core';
import { NativeSettings } from 'capacitor-native-settings';

/**
 * The native-settings plugin behind a token, so the gateway spec can substitute a hand-written stub
 * and the plugin never has to exist under jsdom.
 */
export const NATIVE_SETTINGS = new InjectionToken<typeof NativeSettings>('NATIVE_SETTINGS', {
  providedIn: 'root',
  factory: () => NativeSettings,
});
