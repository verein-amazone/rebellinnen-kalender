import { inject, Injectable } from '@angular/core';

import { devicePlatform } from '@app/cross-cutting/infrastructure/device-platform';

import { SHAKE_PLUGIN } from '@app/cross-cutting/plugins/shake.plugin';

/**
 * How hard the phone has to be shaken before the gesture counts. Declared here rather than imported
 * from the plugin: a plugin type may not leave `../plugins/`, and the three values are the whole
 * vocabulary.
 */
export type ShakeSensitivity = 'light' | 'medium' | 'hard';

/** Options for {@link ShakeGesture.watch}. */
export interface ShakeWatchOptions {
  /** Defaults to the plugin's own `medium` when omitted. */
  readonly sensitivity?: ShakeSensitivity;
}

/**
 * Shake-gesture detection, wrapping `@capawesome/capacitor-shake` (see
 * `../plugins/shake.plugin.ts`).
 *
 * Android and iOS only; the plugin has no web implementation, so on the web this is a no-op that
 * hands back a stop function which does nothing. Callers therefore never branch on the platform.
 */
@Injectable({ providedIn: 'root' })
export class ShakeGesture {
  private readonly plugin = inject(SHAKE_PLUGIN);
  private readonly isWeb = devicePlatform() === 'web';

  /**
   * Starts listening and resolves with the function that stops it again. Failing to start is
   * silent: a device whose sensors refuse is a device without the gesture, not a broken screen.
   */
  async watch(onShake: () => void, options: ShakeWatchOptions = {}): Promise<() => void> {
    if (this.isWeb) {
      return () => undefined;
    }

    try {
      const listener = await this.plugin.addListener('shake', onShake);
      await this.plugin.startWatching(options);

      return () => {
        void listener.remove();
        void this.plugin.stopWatching();
      };
    } catch {
      return () => undefined;
    }
  }
}
