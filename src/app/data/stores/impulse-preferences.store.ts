import { Injectable, signal } from '@angular/core';

import { scopedStorageName } from '@app/cross-cutting/infrastructure/deployment-scope';

import {
  DEFAULT_IMPULSE_PREFERENCES,
  IMPULSE_GREETING_IDS,
  type ImpulseGreetingId,
  type ImpulsePreferences,
} from './impulse-preferences';

const STORAGE_KEY = scopedStorageName('rk.impulsePreferences');

/** Where the greeting preference lived before it got its own store. Read once, never written. */
const LEGACY_APPEARANCE_KEY = scopedStorageName('rk.appearance');

/**
 * Persists the Tagesimpuls preferences.
 *
 * A single scalar read on every startup, so it lives in `localStorage` like the appearance and
 * reminder preferences. Every read is validated: an unknown value must never decide whether the
 * card moves.
 *
 * The greeting used to be part of the appearance preferences, as `impulseGreeting` with the ids
 * `full`, `motion` and `none`. On the first read without an own entry that value is carried over
 * and written here straight away, so it survives the appearance store dropping the old field on its
 * next write. Only „Ohne Begrüßung“ (`none`) is carried over as such; `full` and `motion` both
 * become the new default, because they differed only in the vibration, which is now its own
 * app-wide setting.
 */
@Injectable({ providedIn: 'root' })
export class ImpulsePreferencesStore {
  private readonly preferencesState = signal<ImpulsePreferences>(this.read());

  readonly preferences = this.preferencesState.asReadonly();

  update(patch: Partial<ImpulsePreferences>): void {
    const next: ImpulsePreferences = { ...this.preferencesState(), ...patch };
    this.preferencesState.set(next);
    this.write(next);
  }

  private read(): ImpulsePreferences {
    const raw = this.storage()?.getItem(STORAGE_KEY);
    if (raw === null || raw === undefined) {
      const migrated = this.readLegacy();
      if (migrated !== null) {
        this.write(migrated);
        return migrated;
      }
      return DEFAULT_IMPULSE_PREFERENCES;
    }

    const candidate = parseObject(raw);
    if (candidate === null) {
      return DEFAULT_IMPULSE_PREFERENCES;
    }

    return {
      greeting: IMPULSE_GREETING_IDS.includes(candidate['greeting'] as ImpulseGreetingId)
        ? (candidate['greeting'] as ImpulseGreetingId)
        : DEFAULT_IMPULSE_PREFERENCES.greeting,
    };
  }

  /** The greeting carried over from the appearance preferences, or `null` when there is none. */
  private readLegacy(): ImpulsePreferences | null {
    const raw = this.storage()?.getItem(LEGACY_APPEARANCE_KEY);
    if (raw === null || raw === undefined) {
      return null;
    }

    const legacy = parseObject(raw)?.['impulseGreeting'];
    if (legacy === undefined) {
      return null;
    }

    return { greeting: legacy === 'none' ? 'off' : DEFAULT_IMPULSE_PREFERENCES.greeting };
  }

  private write(preferences: ImpulsePreferences): void {
    try {
      this.storage()?.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Storage can be unavailable or full. Losing a preference is preferable to breaking the app.
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

function parseObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
