import { InjectionToken } from '@angular/core';
import { Keyboard } from '@capacitor/keyboard';
import type { PluginListenerHandle } from '@capacitor/core';

/** What the plugin reports when the keyboard is about to open, in CSS pixels on both platforms. */
export interface KeyboardOpening {
  readonly keyboardHeight: number;
}

/** The slice of the on-screen keyboard plugin this app uses. */
export interface KeyboardPlugin {
  addListener(
    eventName: 'keyboardWillShow',
    listener: (info: KeyboardOpening) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'keyboardWillHide' | 'keyboardDidHide',
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
    // none of them.
    addListener: (
      eventName: 'keyboardWillShow' | 'keyboardWillHide' | 'keyboardDidHide',
      listener: (info: KeyboardOpening) => void,
    ) => {
      switch (eventName) {
        case 'keyboardWillShow':
          return Keyboard.addListener('keyboardWillShow', (info) =>
            listener({ keyboardHeight: info.keyboardHeight }),
          );
        case 'keyboardWillHide':
          return Keyboard.addListener('keyboardWillHide', () => listener({ keyboardHeight: 0 }));
        case 'keyboardDidHide':
          return Keyboard.addListener('keyboardDidHide', () => listener({ keyboardHeight: 0 }));
      }
    },
  }),
});
