import { Injectable, signal } from '@angular/core';

import {
  DEFAULT_APPEARANCE_PREFERENCES,
  MOTION_IDS,
  THEME_IDS,
  TEXT_SIZE_IDS,
  type AppearancePreferences,
} from './appearance-preferences';

const STORAGE_KEY = 'rk.appearance';

/**
 * Persists the appearance preferences.
 *
 * These are three scalar values read on every startup, so they live in `localStorage` rather than
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
