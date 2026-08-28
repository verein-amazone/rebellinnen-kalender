import { InjectionToken } from '@angular/core';
import { AccessibilityPreferences } from '@capawesome/capacitor-accessibility-preferences';

/** The slice of the accessibility-preferences plugin this app uses. */
export type AccessibilityPreferencesPlugin = Pick<
  typeof AccessibilityPreferences,
  'getPreferences'
>;

/**
 * The OS accessibility-preferences plugin. See ./README.md for why it is behind a token, and
 * `app.plugin.ts` for why the token holds a plain object rather than the plugin proxy.
 */
export const ACCESSIBILITY_PREFERENCES = new InjectionToken<AccessibilityPreferencesPlugin>(
  'ACCESSIBILITY_PREFERENCES',
  {
    providedIn: 'root',
    factory: () => ({ getPreferences: () => AccessibilityPreferences.getPreferences() }),
  },
);
