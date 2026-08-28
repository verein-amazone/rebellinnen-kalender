import { inject, Injectable } from '@angular/core';

import { HapticsGateway, type HapticPulse } from '@app/data/gateways/haptics.gateway';
import { AppearanceStore } from '@app/data/stores/appearance.store';

/**
 * The Tagesimpuls greeting, as felt rather than seen.
 *
 * The envelope follows the card's wave (`styles/components/arrived.css`) beat for beat: a first
 * tap where the card tips furthest, then three progressively softer ones as it settles, over the
 * same 1.2 seconds. Intensity and sharpness both fall away, so it fades out like a wave from
 * behind a counter rather than ending on a knock.
 */
const ARRIVAL_PATTERN: readonly HapticPulse[] = [
  { time: 0, intensity: 0.75, sharpness: 0.45 },
  { time: 0.2, intensity: 0.5, sharpness: 0.35 },
  { time: 0.45, intensity: 0.3, sharpness: 0.25 },
  { time: 0.75, intensity: 0.15, sharpness: 0.2 },
];

/**
 * Haptic feedback as an application concern: what a moment should feel like, and whether the user
 * wants to feel it at all.
 */
@Injectable({ providedIn: 'root' })
export class HapticsInteractor {
  private readonly haptics = inject(HapticsGateway);
  private readonly appearance = inject(AppearanceStore);

  /** Plays the arrival greeting, unless the user switched haptics off or the device has none. */
  async playArrival(): Promise<void> {
    if (this.appearance.preferences().haptics !== 'on') {
      return;
    }

    if (!(await this.haptics.isAvailable())) {
      return;
    }

    await this.haptics.playPattern(ARRIVAL_PATTERN);
  }
}
