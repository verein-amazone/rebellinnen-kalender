import { DestroyRef, inject, Injectable } from '@angular/core';

import { CAPACITOR_APP } from '@app/cross-cutting/plugins/app.plugin';

import { devicePlatform } from './device-platform';

/**
 * The app coming back to the foreground.
 *
 * Three unrelated things have to re-read the world at that moment - the local day, the OS text
 * scale and the calendar sources - and each of them used to register its own `appStateChange`
 * listener with its own teardown. One listener, several handlers, one place that knows the event
 * does not arrive the same way everywhere.
 *
 * In the browser build the Capacitor event does not fire, so `visibilitychange` stands in there.
 * Every handler is therefore written to be idempotent and cheap: becoming active may call it more
 * than once, and on the web it fires on any tab switch.
 */
@Injectable({ providedIn: 'root' })
export class AppLifecycle {
  private readonly plugin = inject(CAPACITOR_APP);
  private readonly handlers = new Set<() => void>();

  constructor() {
    const listener = this.plugin.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        this.notify();
      }
    });

    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') {
        this.notify();
      }
    };
    const isWeb = devicePlatform() === 'web';
    if (isWeb) {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }

    inject(DestroyRef).onDestroy(() => {
      void listener.then((handle) => handle.remove());
      if (isWeb) {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    });
  }

  /** Registers a handler for the app becoming active. Returns the function that unregisters it. */
  onResume(handler: () => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private notify(): void {
    for (const handler of this.handlers) {
      handler();
    }
  }
}
