import { InjectionToken } from '@angular/core';
import { NativeSettings } from 'capacitor-native-settings';

/** The plugin that opens the app's own OS settings screen. See ./README.md for why it is behind a token. */
export const NATIVE_SETTINGS = new InjectionToken<typeof NativeSettings>('NATIVE_SETTINGS', {
  providedIn: 'root',
  factory: () => NativeSettings,
});

/**
 * The plugin's own screen enums. Re-exported rather than imported at the call site, so the package
 * still has exactly one import site in the app.
 */
export { AndroidSettings, IOSSettings } from 'capacitor-native-settings';
