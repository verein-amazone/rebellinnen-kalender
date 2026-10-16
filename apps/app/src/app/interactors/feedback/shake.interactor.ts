import { inject, Injectable } from '@angular/core';

import {
  ShakeGesture,
  type ShakeWatchOptions,
} from '@app/cross-cutting/infrastructure/shake-gesture';

export type {
  ShakeSensitivity,
  ShakeWatchOptions,
} from '@app/cross-cutting/infrastructure/shake-gesture';

/**
 * Shaking the phone as an input. Used on Today to replay the Tagesimpuls greeting, which is a
 * deliberate extra on top of a control that is always reachable by tapping - the gesture is never
 * the only way to anything (see the touch-first rules in CLAUDE.md).
 */
@Injectable({ providedIn: 'root' })
export class ShakeInteractor {
  private readonly shake = inject(ShakeGesture);

  /** Resolves with the function that stops listening again; a no-op where the gesture does not exist. */
  watch(onShake: () => void, options: ShakeWatchOptions = {}): Promise<() => void> {
    return this.shake.watch(onShake, options);
  }
}
