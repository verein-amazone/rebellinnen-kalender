import { signal } from '@angular/core';

interface StoredState {
  readonly version: number | null;
}

const EMPTY_STATE: StoredState = { version: null };

/**
 * Remembers the version of a bundled catalog asset last reconciled into SQLite, so a version match
 * skips the diff-and-write work on every read - a cheap local JSON fetch, not the reconciliation
 * itself, is the only cost of a no-op check.
 *
 * A small persisted scalar, so it lives in `localStorage` under the key a subclass names.
 */
export abstract class CatalogVersionStore {
  private readonly state = signal<StoredState>(this.read());

  /** `scopedStorageName(…)` of the subclass's key - evaluated before the first read. */
  protected abstract get storageKey(): string;

  readonly syncedVersion = () => this.state().version;

  setSyncedVersion(version: number): void {
    const next: StoredState = { version };
    this.state.set(next);
    this.write(next);
  }

  private read(): StoredState {
    const raw = this.storage()?.getItem(this.storageKey);
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
      this.storage()?.setItem(this.storageKey, JSON.stringify(state));
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
