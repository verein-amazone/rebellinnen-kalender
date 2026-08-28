import { inject, Injectable } from '@angular/core';

import { devicePlatform } from '@app/cross-cutting/infrastructure/device-platform';

import { SHAKE_PLUGIN } from './shake-plugin';

/**
 * Shake-gesture detection - the only importer of `@capawesome/capacitor-shake`.
 *
 * Android and iOS only; the plugin has no web implementation, so on the web this is a no-op that
 * hands back a stop function which does nothing. Callers therefore never branch on the platform.
 */
@Injectable({ providedIn: 'root' })
export class ShakeGateway {
  private readonly plugin = inject(SHAKE_PLUGIN);
  private readonly isWeb = devicePlatform() === 'web';

  /**
   * Starts listening and resolves with the function that stops it again. Failing to start is
   * silent: a device whose sensors refuse is a device without the gesture, not a broken screen.
   */
  async watch(onShake: () => void): Promise<() => void> {
    if (this.isWeb) {
      return () => undefined;
    }

    try {
      const listener = await this.plugin.addListener('shake', onShake);
      await this.plugin.startWatching();

      return () => {
        void listener.remove();
        void this.plugin.stopWatching();
      };
    } catch {
      return () => undefined;
    }
  }
}
