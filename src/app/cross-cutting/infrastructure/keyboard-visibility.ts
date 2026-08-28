import { DestroyRef, inject, Injectable, signal } from '@angular/core';

import { KEYBOARD_PLUGIN } from '@app/cross-cutting/plugins/keyboard.plugin';

import { devicePlatform } from './device-platform';

/**
 * Whether the on-screen keyboard is currently open.
 *
 * Native only: `@capacitor/keyboard`'s web implementation throws on `addListener` rather than
 * being a harmless no-op, so the browser build must not call it at all - `visible` simply stays
 * `false` there, which is what it does not need anyway.
 */
@Injectable({ providedIn: 'root' })
export class KeyboardVisibility {
  private readonly plugin = inject(KEYBOARD_PLUGIN);
  private readonly visibleState = signal(false);

  readonly visible = this.visibleState.asReadonly();

  constructor() {
    if (devicePlatform() === 'web') {
      return;
    }

    const showListener = this.plugin.addListener('keyboardWillShow', () => {
      this.visibleState.set(true);
    });
    // `Did`, not `Will`: the consumer clamps scroll position once this flips back to `false` (see
    // main-navigation.scaffold.ts), which needs the keyboard's own resize/close animation already
    // finished and the layout settled, not just started.
    const hideListener = this.plugin.addListener('keyboardDidHide', () => {
      this.visibleState.set(false);
    });

    inject(DestroyRef).onDestroy(() => {
      void showListener.then((handle) => handle.remove());
      void hideListener.then((handle) => handle.remove());
    });
  }
}
