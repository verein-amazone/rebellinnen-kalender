import { DestroyRef, inject, Injectable } from '@angular/core';

import { CAPACITOR_APP } from '@app/cross-cutting/plugins/app.plugin';

import { DevicePlatformService } from './device-platform';

/**
 * A step back: returns `true` when it handled the press, `false` to let the next one decide.
 */
export type HardwareBackHandler = () => boolean;

/**
 * Android's hardware back button and back gesture.
 *
 * Without a listener, Capacitor walks the WebView's history - which this app does not keep in step
 * with what is on screen: screens are left with `replaceUrl`, sheets are overlays rather than
 * routes, and an edit view is a state of its page. The press then did nothing on the first screen
 * (it never left the app), reopened screens the user had already left, navigated away under an
 * open sheet and dropped unsaved edits.
 *
 * So the press is handed to whatever is in front instead: the most recently registered handler
 * first - an open sheet registers while it is open, a focused screen while it is shown - and the
 * app goes to the background, as Android's own first screen does, when nothing takes it.
 *
 * Instantiated by `App` at startup, so the default history walk is replaced before the first press.
 * iOS has no back button and the web has the browser's, so neither registers the listener.
 */
@Injectable({ providedIn: 'root' })
export class HardwareBack {
  private readonly plugin = inject(CAPACITOR_APP);
  private readonly handlers: HardwareBackHandler[] = [];

  constructor() {
    if (inject(DevicePlatformService).platform !== 'android') {
      return;
    }

    const listener = this.plugin.addBackButtonListener(() => this.press());
    inject(DestroyRef).onDestroy(() => void listener.then((handle) => handle.remove()));
  }

  /** Registers a handler that is asked before every earlier one. Returns its removal. */
  register(handler: HardwareBackHandler): () => void {
    this.handlers.push(handler);
    return () => {
      const index = this.handlers.lastIndexOf(handler);
      if (index !== -1) {
        this.handlers.splice(index, 1);
      }
    };
  }

  /** One press: the newest handler that takes it, or the app goes to the background. */
  press(): void {
    for (const handler of [...this.handlers].reverse()) {
      if (handler()) {
        return;
      }
    }

    void this.plugin.minimizeApp();
  }
}
