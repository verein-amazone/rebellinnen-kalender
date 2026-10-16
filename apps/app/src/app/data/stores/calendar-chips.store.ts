import { Injectable, signal } from '@angular/core';

import {
  DEFAULT_CALENDAR_CHIP_PREFERENCES,
  MAX_STORED_CALENDAR_IDS,
  type CalendarChipPreferences,
} from './calendar-chip-preferences';

const STORAGE_KEY = 'rk.calendarChips';

/**
 * Persists how the Kalender screen's filter chips are presented - which calendars are hidden and
 * in which order the chips appear.
 *
 * `localStorage` rather than SQLite, like `ProfileStore` and `AppearanceStore`: two short lists
 * read once on startup, needed synchronously while the screen renders, and no part of the calendar
 * data itself. Every read is validated, since the stored value may come from an older app version
 * or a hand-edited entry. `app-data-reset` clears everything under the `rk.` prefix, so this key
 * needs no separate handling there.
 */
@Injectable({ providedIn: 'root' })
export class CalendarChipsStore {
  private readonly preferencesState = signal<CalendarChipPreferences>(this.read());

  readonly preferences = this.preferencesState.asReadonly();

  update(patch: Partial<CalendarChipPreferences>): void {
    const next: CalendarChipPreferences = {
      hiddenCalendarIds: pickIds(
        patch.hiddenCalendarIds ?? this.preferencesState().hiddenCalendarIds,
      ),
      calendarOrder: pickIds(patch.calendarOrder ?? this.preferencesState().calendarOrder),
    };
    this.preferencesState.set(next);
    this.write(next);
  }

  private read(): CalendarChipPreferences {
    const raw = this.storage()?.getItem(STORAGE_KEY);
    if (raw === null || raw === undefined) {
      return DEFAULT_CALENDAR_CHIP_PREFERENCES;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return DEFAULT_CALENDAR_CHIP_PREFERENCES;
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return DEFAULT_CALENDAR_CHIP_PREFERENCES;
    }

    const candidate = parsed as Partial<Record<keyof CalendarChipPreferences, unknown>>;
    return {
      hiddenCalendarIds: pickIds(candidate.hiddenCalendarIds),
      calendarOrder: pickIds(candidate.calendarOrder),
    };
  }

  private write(preferences: CalendarChipPreferences): void {
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

/** Keeps non-empty strings only, de-duplicated and capped - both lists are sets of calendar ids. */
function pickIds(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const ids = value.filter((entry): entry is string => typeof entry === 'string' && entry !== '');
  return [...new Set(ids)].slice(0, MAX_STORED_CALENDAR_IDS);
}
