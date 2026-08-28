import { InjectionToken } from '@angular/core';
import { Keyboard } from '@capacitor/keyboard';
import type { PluginListenerHandle } from '@capacitor/core';

/** The slice of the on-screen keyboard plugin this app uses. */
export interface KeyboardPlugin {
  addListener(
    eventName: 'keyboardWillShow' | 'keyboardDidHide',
    listener: () => void,
  ): Promise<PluginListenerHandle>;
}

/**
 * The on-screen keyboard plugin. See ./README.md for why it is behind a token, and `app.plugin.ts`
 * for why the token holds a plain object rather than the plugin proxy.
 */
export const KEYBOARD_PLUGIN = new InjectionToken<KeyboardPlugin>('KEYBOARD_PLUGIN', {
  providedIn: 'root',
  factory: () => ({
    // Spelled out per event: the plugin declares one overload each, and a union argument matches
    // neither of them.
    addListener: (eventName, listener) =>
      eventName === 'keyboardWillShow'
        ? Keyboard.addListener('keyboardWillShow', listener)
        : Keyboard.addListener('keyboardDidHide', listener),
  }),
});
