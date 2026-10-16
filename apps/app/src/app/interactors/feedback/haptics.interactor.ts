import { inject, Injectable } from '@angular/core';

import { DeviceHaptics, type HapticPulse } from '@app/cross-cutting/infrastructure/haptics';
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
 * How much longer a replayed greeting takes than the once-a-day one. Shaking the phone is a
 * deliberate act, so the answer may take its time. The card's wave is stretched by the same factor
 * (`.rk-arrived-stretched` in `styles/components/arrived.css`), so the two channels stay on one
 * beat.
 */
const REPLAY_STRETCH = 1.5;

/**
 * Haptic feedback as an application concern: what a moment should feel like, and whether the user
 * wants to feel it at all.
 *
 * Every haptic in the app goes through here, behind the one vibration setting. They confirm an
 * outcome the user caused and cares about - an appointment saved, a switch flipped, a bookmark
 * set, an entry dropped into place, another option picked - and never accompany navigation,
 * scrolling or an ordinary tap: a phone that buzzes all the time stops meaning anything by it.
 */
@Injectable({ providedIn: 'root' })
export class HapticsInteractor {
  private readonly haptics = inject(DeviceHaptics);
  private readonly appearance = inject(AppearanceStore);

  /** Plays the Tagesimpuls greeting, unless vibration is off or the device has no haptics. */
  async playArrival(options: { readonly replay?: boolean } = {}): Promise<void> {
    if (!(await this.mayVibrate())) {
      return;
    }

    await this.haptics.playPattern(
      options.replay === true ? stretch(ARRIVAL_PATTERN, REPLAY_STRETCH) : ARRIVAL_PATTERN,
    );
  }

  /** Something the user created was saved - an appointment, for instance. */
  async confirm(): Promise<void> {
    if (await this.mayVibrate()) {
      await this.haptics.success();
    }
  }

  /**
   * A small state change the user caused: any switch or checkbox flipped (via `CheckHaptics`, both
   * ways), or a bookmark set.
   */
  async tick(): Promise<void> {
    if (await this.mayVibrate()) {
      await this.haptics.lightImpact();
    }
  }

  /**
   * An entry picked up or put down while reordering a list, another option picked in a choice, or a
   * filter chip toggled.
   */
  async selection(): Promise<void> {
    if (await this.mayVibrate()) {
      await this.haptics.selectionChanged();
    }
  }

  private async mayVibrate(): Promise<boolean> {
    return this.appearance.preferences().vibration === 'on' && (await this.haptics.isAvailable());
  }
}

/** Spreads a pattern over a longer span without touching how hard any single tap feels. */
function stretch(pattern: readonly HapticPulse[], factor: number): readonly HapticPulse[] {
  return pattern.map((pulse) => ({ ...pulse, time: pulse.time * factor }));
}
