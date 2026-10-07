import { computed, Injectable, signal } from '@angular/core';

import { scopedStorageName } from '@app/cross-cutting/infrastructure/deployment-scope';

const STORAGE_KEY = scopedStorageName('rk.intro');

interface IntroState {
  /** When the introduction was finished or skipped (ISO instant); `null` until then. */
  readonly seenAt: string | null;
  /** The step (1-based) the user last reached, so an interrupted introduction resumes there. */
  readonly step: number;
}

const UNSEEN: IntroState = { seenAt: null, step: 1 };

/**
 * Remembers how far the first-launch introduction (#82) got - the step reached, and whether it was
 * finished or skipped - in `localStorage` like the other small preferences. Under the `rk.` prefix,
 * so „App-Daten löschen“ brings the introduction back along with everything else.
 */
@Injectable({ providedIn: 'root' })
export class IntroStore {
  private readonly state = signal<IntroState>(this.read());

  readonly seenAt = computed(() => this.state().seenAt);
  readonly step = computed(() => this.state().step);

  markSeen(nowUtc: string): void {
    this.write({ ...this.state(), seenAt: nowUtc });
  }

  rememberStep(step: number): void {
    this.write({ ...this.state(), step });
  }

  /** Forgets everything, so the introduction shows again from its first step. */
  reset(): void {
    this.state.set(UNSEEN);
    try {
      this.storage()?.removeItem(STORAGE_KEY);
    } catch {
      // Storage can be unavailable; the in-memory state is reset either way.
    }
  }

  private write(next: IntroState): void {
    this.state.set(next);
    try {
      this.storage()?.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage can be unavailable or full. Seeing the introduction again beats breaking the app.
    }
  }

  private read(): IntroState {
    const raw = this.storage()?.getItem(STORAGE_KEY);
    if (raw === null || raw === undefined) {
      return UNSEEN;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<Record<keyof IntroState, unknown>> | null;
      const seenAt = parsed?.seenAt;
      const step = parsed?.step;
      return {
        seenAt: typeof seenAt === 'string' && seenAt !== '' ? seenAt : null,
        step: typeof step === 'number' && Number.isInteger(step) && step >= 1 ? step : 1,
      };
    } catch {
      return UNSEEN;
    }
  }

  /** `localStorage` access throws in some privacy modes, so it is never touched directly. */
  private storage(): Storage | null {
    try {
      return globalThis.localStorage ?? null;
    } catch {
      return null;
    }
  }
}
