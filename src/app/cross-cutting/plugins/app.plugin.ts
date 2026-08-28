import { InjectionToken } from '@angular/core';
import { App, type AppState } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';

/** The slice of the app-lifecycle plugin this app uses. */
export interface CapacitorAppPlugin {
  addListener(
    eventName: 'appStateChange',
    listener: (state: AppState) => void,
  ): Promise<PluginListenerHandle>;
}

/**
 * The app-lifecycle plugin. See ./README.md for why it is behind a token.
 *
 * Handed on as a plain object rather than the plugin itself: a Capacitor plugin proxy answers
 * *every* property, so Angular's DI sees an `ngOnDestroy` on it and calls that on teardown, which
 * rejects with `"App.ngOnDestroy() is not implemented on web"` in every jsdom spec that reaches
 * this token transitively.
 */
export const CAPACITOR_APP = new InjectionToken<CapacitorAppPlugin>('CAPACITOR_APP', {
  providedIn: 'root',
  factory: () => ({
    addListener: (eventName, listener) => App.addListener(eventName, listener),
  }),
});
