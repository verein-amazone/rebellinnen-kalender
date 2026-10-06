import { Injectable, signal } from '@angular/core';

import { scopedStorageName } from '@app/cross-cutting/infrastructure/deployment-scope';

import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  normalizedReminders,
  type NotificationPreferences,
} from './notification-preferences';

const STORAGE_KEY = scopedStorageName('rk.notifications');

/**
 * Persists the reminder preferences in `localStorage`, like the other small preferences, validating
 * every read: a malformed list falls back to the default list, never to „no reminders“.
 */
@Injectable({ providedIn: 'root' })
export class NotificationPreferencesStore {
  private readonly preferencesState = signal<NotificationPreferences>(this.read());

  readonly preferences = this.preferencesState.asReadonly();

  update(patch: Partial<NotificationPreferences>): void {
    const next: NotificationPreferences = { ...this.preferencesState(), ...patch };
    this.preferencesState.set(next);
    try {
      this.storage()?.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage can be unavailable or full. Losing a preference is preferable to breaking the app.
    }
  }

  private read(): NotificationPreferences {
    const raw = this.storage()?.getItem(STORAGE_KEY);
    if (raw === null || raw === undefined) {
      return DEFAULT_NOTIFICATION_PREFERENCES;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return DEFAULT_NOTIFICATION_PREFERENCES;
    }
    if (typeof parsed !== 'object' || parsed === null) {
      return DEFAULT_NOTIFICATION_PREFERENCES;
    }

    const candidate = parsed as Partial<Record<keyof NotificationPreferences, unknown>>;
    return {
      enabled:
        typeof candidate.enabled === 'boolean'
          ? candidate.enabled
          : DEFAULT_NOTIFICATION_PREFERENCES.enabled,
      timedDefaults: pickList(
        candidate.timedDefaults,
        DEFAULT_NOTIFICATION_PREFERENCES.timedDefaults,
      ),
      allDayDefaults: pickList(
        candidate.allDayDefaults,
        DEFAULT_NOTIFICATION_PREFERENCES.allDayDefaults,
      ),
    };
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

function pickList(value: unknown, fallback: readonly number[]): readonly number[] {
  return Array.isArray(value) && value.every((minutes) => Number.isInteger(minutes))
    ? normalizedReminders(value as number[])
    : fallback;
}
