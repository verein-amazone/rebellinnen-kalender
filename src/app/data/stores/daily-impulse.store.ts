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
  /** The day whose impulse the user has already been shown, so it is only announced once. */
  readonly seenDay: string | null;
}

const EMPTY_STATE: StoredState = { day: null, itemId: null, recentIds: [], seenDay: null };

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

  /** Whether today's impulse has already been shown to the user at least once. */
  readonly hasSeen = (day: string) => this.state().seenDay === day;

  /** Records today's pick and rolls it into the recent-ids window. */
  setPick(day: string, itemId: string): void {
    const nextRecentIds = [...this.state().recentIds, itemId].slice(-HIGHLIGHT_COOLDOWN_DAYS);
    const next: StoredState = { ...this.state(), day, itemId, recentIds: nextRecentIds };
    this.state.set(next);
    this.write(next);
  }

  /**
   * Forces the day's pick to a specific item, for the debug catalog. Unlike `setPick` it leaves the
   * recent-ids cooldown alone - a hand-picked impulse is not a real selection and must not push a
   * genuine one out of the window - and clears `seenDay`, so Today announces the new pick the same
   * way it announces a fresh one.
   */
  overridePick(day: string, itemId: string): void {
    const next: StoredState = { ...this.state(), day, itemId, seenDay: null };
    this.state.set(next);
    this.write(next);
  }

  /** Records that the user has seen the given day's impulse. */
  markSeen(day: string): void {
    if (this.state().seenDay === day) {
      return;
    }

    const next: StoredState = { ...this.state(), seenDay: day };
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
    const seenDay = typeof candidate.seenDay === 'string' ? candidate.seenDay : null;

    if (day === null || itemId === null) {
      return { day: null, itemId: null, recentIds, seenDay };
    }

    return { day, itemId, recentIds, seenDay };
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
