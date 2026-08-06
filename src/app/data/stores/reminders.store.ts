import { Injectable, signal } from '@angular/core';

import {
  DEFAULT_REMINDER_PREFERENCES,
  REMINDER_PLACEMENT_IDS,
  type ReminderPreferences,
} from './reminder-preferences';

const STORAGE_KEY = 'rk.reminders';

/**
 * Persists the preferences of the „Nicht vergessen“ list.
 *
 * Three scalar values read on every startup, so they live in `localStorage` rather than in SQLite,
 * exactly like the appearance preferences. The entries themselves stay in the database — a store is
 * not where a table-backed list belongs.
 *
 * Every read is validated: stored values may come from an older app version or from a manually
 * edited storage entry, and an unknown value must never decide where an entry lands.
 */
@Injectable({ providedIn: 'root' })
export class RemindersStore {
  private readonly preferencesState = signal<ReminderPreferences>(this.read());

  readonly preferences = this.preferencesState.asReadonly();

  update(patch: Partial<ReminderPreferences>): void {
    const next: ReminderPreferences = { ...this.preferencesState(), ...patch };
    this.preferencesState.set(next);
    this.write(next);
  }

  private read(): ReminderPreferences {
    const raw = this.storage()?.getItem(STORAGE_KEY);
    if (raw === null || raw === undefined) {
      return DEFAULT_REMINDER_PREFERENCES;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return DEFAULT_REMINDER_PREFERENCES;
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return DEFAULT_REMINDER_PREFERENCES;
    }

    const candidate = parsed as Partial<Record<keyof ReminderPreferences, unknown>>;
    return {
      newItemPlacement: pick(
        candidate.newItemPlacement,
        REMINDER_PLACEMENT_IDS,
        DEFAULT_REMINDER_PREFERENCES.newItemPlacement,
      ),
      completedItemPlacement: pick(
        candidate.completedItemPlacement,
        REMINDER_PLACEMENT_IDS,
        DEFAULT_REMINDER_PREFERENCES.completedItemPlacement,
      ),
      hideCompletedAtDayChange:
        typeof candidate.hideCompletedAtDayChange === 'boolean'
          ? candidate.hideCompletedAtDayChange
          : DEFAULT_REMINDER_PREFERENCES.hideCompletedAtDayChange,
    };
  }

  private write(preferences: ReminderPreferences): void {
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
