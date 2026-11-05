import { Injectable, signal } from '@angular/core';

import {
  DEFAULT_APPEARANCE_PREFERENCES,
  MOTION_IDS,
  THEME_IDS,
  TEXT_SIZE_IDS,
  VIBRATION_IDS,
  type AppearancePreferences,
  type ThemeId,
  type VibrationId,
} from './appearance-preferences';

const STORAGE_KEY = 'rk.appearance';

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
      theme: readTheme(candidate.theme),
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
 * Themes that no longer exist, mapped to the one closest to what the user saw. The dynamic pairs
 * (and the single „Systemeinstellung“ theme before them) keep their light half; Sonnenuntergang
 * (`warm`) has no close relative and falls back to the default.
 */
const REMOVED_THEMES: Readonly<Record<string, ThemeId>> = {
  system: 'amazone',
  'amazone-nacht': 'amazone',
  'lila-nacht': 'lila',
};

function readTheme(value: unknown): ThemeId {
  if (typeof value === 'string' && Object.hasOwn(REMOVED_THEMES, value)) {
    return REMOVED_THEMES[value];
  }
  return pick(value, THEME_IDS, DEFAULT_APPEARANCE_PREFERENCES.theme);
}

/**
 * The vibration switch replaced two older preferences that also decided whether the phone buzzed:
 * an on/off `haptics` switch, and after it the three-way `impulseGreeting` whose „Nur Animation“
 * (`motion`) meant the wave without the buzz. An install that had turned the vibration off either
 * way keeps it off. `impulseGreeting: 'none'` is not carried over - it meant no greeting at all,
 * which reduced motion („Wenig“) now stands for.
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
