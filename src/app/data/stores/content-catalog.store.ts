import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'rk.contentCatalog';

interface StoredState {
  readonly version: number | null;
}

const EMPTY_STATE: StoredState = { version: null };

/**
 * Remembers the version of `public/content/catalog.json` last reconciled into `content_items` by
 * `ContentCatalogSync`, so a version match skips the diff-and-write work on every app open - a
 * cheap local JSON fetch, not the reconciliation itself, is the only cost of a no-op check.
 *
 * A small persisted scalar, like `DailyImpulseStore`, so it lives in `localStorage`.
 */
@Injectable({ providedIn: 'root' })
export class ContentCatalogStore {
  private readonly state = signal<StoredState>(this.read());

  readonly syncedVersion = () => this.state().version;

  setSyncedVersion(version: number): void {
    const next: StoredState = { version };
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
    return typeof candidate.version === 'number' ? { version: candidate.version } : EMPTY_STATE;
  }

  private write(state: StoredState): void {
    try {
      this.storage()?.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage can be unavailable or full. Re-checking the catalog next time is preferable to
      // breaking the app.
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
