import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'rk.dailyImpulse';

/**
 * How many recently featured items are excluded from the next pick - the highlight cooldown.
 * One entry is stored per calendar day a fresh pick is made (see `DailyImpulseInteractor`), so
 * this approximates a 14-day cooldown. Raise this once the catalog has enough content that a
 * 14-day gap between repeats is no longer needed to feel varied.
 */
const HIGHLIGHT_COOLDOWN_DAYS = 14;

export interface DailyImpulsePick {
  readonly day: string;
  readonly itemId: string;
}

interface StoredState {
  readonly day: string | null;
  readonly itemId: string | null;
  readonly recentIds: readonly string[];
}

const EMPTY_STATE: StoredState = { day: null, itemId: null, recentIds: [] };

/**
 * Persists which content item is featured on the Today page for the day it was picked, so the item
 * stays stable across reopens of the app rather than changing whenever the page renders - the
 * selection interactor only calls `selectDailyImpulse` again once `day` no longer matches today.
 *
 * `recentIds` is a rolling window of recently featured ids, oldest first, that the selector excludes
 * from the next pick to avoid repeatedly surfacing the same small set of items.
 *
 * A small persisted scalar, like `RemindersStore`, so it lives in `localStorage` rather than SQLite.
 */
@Injectable({ providedIn: 'root' })
export class DailyImpulseStore {
  private readonly state = signal<StoredState>(this.read());

  readonly pick = () => {
    const { day, itemId } = this.state();
    return day !== null && itemId !== null ? { day, itemId } : null;
  };

  readonly recentIds = () => this.state().recentIds;

  /** Records today's pick and rolls it into the recent-ids window. */
  setPick(day: string, itemId: string): void {
    const nextRecentIds = [...this.state().recentIds, itemId].slice(-HIGHLIGHT_COOLDOWN_DAYS);
    const next: StoredState = { day, itemId, recentIds: nextRecentIds };
    this.state.set(next);
    this.write(next);
  }

  private read(): StoredState {
    const raw = this.storage()?.getItem(STORAGE_KEY);
    if (raw === null || raw === undefined) {
      return EMPTY_STATE;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return EMPTY_STATE;
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return EMPTY_STATE;
    }

    const candidate = parsed as Partial<Record<keyof StoredState, unknown>>;
    const day = typeof candidate.day === 'string' ? candidate.day : null;
    const itemId = typeof candidate.itemId === 'string' ? candidate.itemId : null;
    const recentIds = Array.isArray(candidate.recentIds)
      ? candidate.recentIds.filter((id): id is string => typeof id === 'string')
      : [];

    if (day === null || itemId === null) {
      return { day: null, itemId: null, recentIds };
    }

    return { day, itemId, recentIds };
  }

  private write(state: StoredState): void {
    try {
      this.storage()?.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage can be unavailable or full. Losing the stable pick for a day is preferable to
      // breaking the app - the selector simply runs again and picks something eligible.
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
