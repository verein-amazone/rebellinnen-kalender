import { Injectable, signal } from '@angular/core';

import {
  DEFAULT_PROFILE_PREFERENCES,
  NAME_MAX_LENGTH,
  type ProfilePreferences,
} from './profile-preferences';

const STORAGE_KEY = 'rk.profile';

/**
 * Persists the profile preferences (name and personal emoji) the same way `AppearanceStore`
 * persists appearance: two scalar values read on every startup, in `localStorage` rather than
 * SQLite, validated on every read since the stored value may come from an older app version or a
 * manually edited entry.
 */
@Injectable({ providedIn: 'root' })
export class ProfileStore {
  private readonly preferencesState = signal<ProfilePreferences>(this.read());

  readonly preferences = this.preferencesState.asReadonly();

  update(patch: Partial<ProfilePreferences>): void {
    const next: ProfilePreferences = { ...this.preferencesState(), ...patch };
    this.preferencesState.set(next);
    this.write(next);
  }

  private read(): ProfilePreferences {
    const raw = this.storage()?.getItem(STORAGE_KEY);
    if (raw === null || raw === undefined) {
      return DEFAULT_PROFILE_PREFERENCES;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return DEFAULT_PROFILE_PREFERENCES;
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return DEFAULT_PROFILE_PREFERENCES;
    }

    const candidate = parsed as Partial<Record<keyof ProfilePreferences, unknown>>;
    return {
      name: pickName(candidate.name),
      emoji: pickEmoji(candidate.emoji),
    };
  }

  private write(preferences: ProfilePreferences): void {
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

function pickName(value: unknown): string | null {
  if (typeof value !== 'string' || value === '') {
    return DEFAULT_PROFILE_PREFERENCES.name;
  }
  return value.slice(0, NAME_MAX_LENGTH);
}

function pickEmoji(value: unknown): string {
  return typeof value === 'string' && value !== '' ? value : DEFAULT_PROFILE_PREFERENCES.emoji;
}
