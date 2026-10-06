import { Injectable, signal } from '@angular/core';

import { scopedStorageName } from '@app/cross-cutting/infrastructure/deployment-scope';

import {
  DEFAULT_APPEARANCE_PREFERENCES,
  MOTION_IDS,
  THEME_IDS,
  TEXT_SIZE_IDS,
  VIBRATION_IDS,
  type AppearancePreferences,
  type VibrationId,
} from './appearance-preferences';

const STORAGE_KEY = scopedStorageName('rk.appearance');

/**
 * Persists the appearance preferences.
 *
 * These are a handful of scalar values read on every startup, so they live in `localStorage` rather than
 * in SQLite. `localStorage` is available in both the iOS and Android WebViews and survives app
 * restarts; it is only cleared when the user clears the app data.
 *
 * Every read is validated: stored values may come from an older app version or from a manually
 * edited storage entry, and an unknown id must never reach the DOM.
 */
@Injectable({ providedIn: 'root' })
export class AppearanceStore {
  private readonly preferencesState = signal<AppearancePreferences>(this.read());

  readonly preferences = this.preferencesState.asReadonly();

  update(patch: Partial<AppearancePreferences>): void {
    const next: AppearancePreferences = { ...this.preferencesState(), ...patch };
    this.preferencesState.set(next);
    this.write(next);
  }

  private read(): AppearancePreferences {
    const raw = this.storage()?.getItem(STORAGE_KEY);
    if (raw === null || raw === undefined) {
      return DEFAULT_APPEARANCE_PREFERENCES;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return DEFAULT_APPEARANCE_PREFERENCES;
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return DEFAULT_APPEARANCE_PREFERENCES;
    }

    const candidate = parsed as Partial<Record<keyof AppearancePreferences, unknown>>;
    return {
      theme: pick(candidate.theme, THEME_IDS, DEFAULT_APPEARANCE_PREFERENCES.theme),
      textSize: pick(candidate.textSize, TEXT_SIZE_IDS, DEFAULT_APPEARANCE_PREFERENCES.textSize),
      motion: pick(candidate.motion, MOTION_IDS, DEFAULT_APPEARANCE_PREFERENCES.motion),
      vibration: readVibration(candidate),
    };
  }

  private write(preferences: AppearancePreferences): void {
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

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/**
 * The vibration switch replaced two older preferences that also decided whether the phone buzzed:
 * an on/off `haptics` switch, and after it the three-way `impulseGreeting` whose „Nur Animation“
 * (`motion`) meant the wave without the buzz. An install that had turned the vibration off either
 * way keeps it off. `impulseGreeting: 'none'` is not carried over here - it meant no greeting at
 * all, which the Tagesimpuls preference now holds (see `ImpulsePreferencesStore`).
 */
function readVibration(
  candidate: Partial<Record<keyof AppearancePreferences | 'haptics' | 'impulseGreeting', unknown>>,
): VibrationId {
  if (VIBRATION_IDS.includes(candidate.vibration as VibrationId)) {
    return candidate.vibration as VibrationId;
  }

  return candidate.haptics === 'off' || candidate.impulseGreeting === 'motion'
    ? 'off'
    : DEFAULT_APPEARANCE_PREFERENCES.vibration;
}
