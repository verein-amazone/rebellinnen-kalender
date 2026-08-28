import { inject, Injectable } from '@angular/core';

import { HAPTICS_PLUGIN } from '@app/cross-cutting/plugins/haptics.plugin';

/**
 * One beat of a haptic pattern, in the app's own terms so `@capawesome/capacitor-haptics` types stay
 * behind this wrapper.
 */
export interface HapticPulse {
  /** When the beat plays, in seconds from the start of the pattern. */
  readonly time: number;
  /** How strong it feels, `0`-`1`. Only respected on Android devices with amplitude control. */
  readonly intensity: number;
  /** How crisp it feels, `0`-`1`. iOS only; lower is rounder and softer. */
  readonly sharpness?: number;
  /** Seconds. Omitted means a transient tap rather than a sustained buzz. */
  readonly duration?: number;
}

/**
 * The device's haptic engine, wrapping `@capawesome/capacitor-haptics` (see
 * `../plugins/haptics.plugin.ts`).
 *
 * Every call swallows its failures. Haptics are decoration: a device without a Taptic Engine, a
 * user who switched system haptics off, or a web browser without the Vibration API must all end up
 * with a silent no-op rather than an error surfacing in a screen that only wanted to say hello.
 */
@Injectable({ providedIn: 'root' })
export class DeviceHaptics {
  private readonly plugin = inject(HAPTICS_PLUGIN);

  async isAvailable(): Promise<boolean> {
    try {
      const { available } = await this.plugin.isAvailable();
      return available;
    } catch {
      return false;
    }
  }

  async playPattern(pulses: readonly HapticPulse[]): Promise<void> {
    try {
      await this.plugin.playPattern({ events: pulses.map((pulse) => ({ ...pulse })) });
    } catch {
      // See the class comment: a pattern that cannot play is not an error worth surfacing.
    }
  }
}
