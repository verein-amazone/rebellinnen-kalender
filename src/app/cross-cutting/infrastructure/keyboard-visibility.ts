import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { Keyboard } from '@capacitor/keyboard';

import { devicePlatform } from './device-platform';

/**
 * Whether the on-screen keyboard is currently open.
 *
 * Native only: `@capacitor/keyboard`'s web implementation throws on `addListener` rather than
 * being a harmless no-op, so the browser build must not call it at all — `visible` simply stays
 * `false` there, which is what it does not need anyway.
 */
@Injectable({ providedIn: 'root' })
export class KeyboardVisibility {
  private readonly visibleState = signal(false);

  readonly visible = this.visibleState.asReadonly();

  constructor() {
    if (devicePlatform() === 'web') {
      return;
    }

    const showListener = Keyboard.addListener('keyboardWillShow', () => {
      this.visibleState.set(true);
    });
    // `Did`, not `Will`: the consumer clamps scroll position once this flips back to `false` (see
    // main-navigation.scaffold.ts), which needs the keyboard's own resize/close animation already
    // finished and the layout settled, not just started.
    const hideListener = Keyboard.addListener('keyboardDidHide', () => {
      this.visibleState.set(false);
    });

    inject(DestroyRef).onDestroy(() => {
      void showListener.then((handle) => handle.remove());
      void hideListener.then((handle) => handle.remove());
    });
  }
}
