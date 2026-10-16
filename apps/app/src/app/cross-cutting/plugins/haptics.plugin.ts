import { InjectionToken } from '@angular/core';
import {
  Haptics,
  type ImpactOptions,
  type IsAvailableResult,
  type NotificationOptions,
  type PlayPatternOptions,
} from '@capawesome/capacitor-haptics';

/** The slice of the haptics plugin this app uses. */
export interface HapticsPlugin {
  isAvailable(): Promise<IsAvailableResult>;
  playPattern(options: PlayPatternOptions): Promise<void>;
  notification(options?: NotificationOptions): Promise<void>;
  impact(options?: ImpactOptions): Promise<void>;
  selectionChanged(): Promise<void>;
}

/**
 * The haptics plugin. See ./README.md for why it is behind a token.
 *
 * Handed on as a plain object rather than the plugin itself, like `CAPACITOR_APP`: a Capacitor
 * plugin proxy answers *every* property, so Angular's DI sees an `ngOnDestroy` on it and calls that
 * on teardown, which rejects with `"Haptics.ngOnDestroy() is not implemented on web"` in every
 * jsdom spec that reaches this token transitively.
 */
export const HAPTICS_PLUGIN = new InjectionToken<HapticsPlugin>('HAPTICS_PLUGIN', {
  providedIn: 'root',
  factory: () => ({
    isAvailable: () => Haptics.isAvailable(),
    playPattern: (options) => Haptics.playPattern(options),
    notification: (options) => Haptics.notification(options),
    impact: (options) => Haptics.impact(options),
    selectionChanged: () => Haptics.selectionChanged(),
  }),
});

/**
 * The plugin's own feedback enums. Re-exported rather than imported at the call site, so the package
 * still has exactly one import site in the app.
 */
export { ImpactStyle, NotificationType } from '@capawesome/capacitor-haptics';
