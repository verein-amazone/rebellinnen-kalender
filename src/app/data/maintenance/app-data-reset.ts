import { inject, Injectable } from '@angular/core';

import { SQLITE_DATABASE } from '../gateways/sqlite-database';

/** Everything the app persists in `localStorage` is namespaced under this prefix. */
const STORAGE_PREFIX = 'rk.';

/**
 * Wipes every piece of state this app owns: all rows in the SQLite database and every namespaced
 * `localStorage` entry. Development tooling, reached from Settings → Entwicklung.
 *
 * Rows rather than the database file: the schema and its version stay exactly as they are, so the
 * next read opens the same connection instead of replaying every migration - the goal is an app
 * that behaves like a fresh install, not a re-created database. Tables are read from
 * `sqlite_master` rather than listed here, so a table added by a future migration is covered
 * without anyone remembering to update this.
 */
@Injectable({ providedIn: 'root' })
export class AppDataReset {
  private readonly database = inject(SQLITE_DATABASE);

  async clearEverything(): Promise<void> {
    await this.clearDatabase();
    this.clearLocalState();
  }

  private async clearDatabase(): Promise<void> {
    // `sqlite_%` is SQLite's own bookkeeping (`sqlite_sequence`), `_%` the plugin's - neither is
    // application data, and emptying either would corrupt state the app does not own.
    const tables = await this.database.query<{ readonly name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_%' ESCAPE '\\';",
    );

    await this.database.transaction(async (tx) => {
      // Tables reference each other (a bookmark points at a content item), so deleting them in
      // `sqlite_master` order trips a foreign key halfway through. Deferring the checks to the
      // commit is what makes the order irrelevant: by then every table is empty and no reference
      // is left dangling. `PRAGMA foreign_keys` would be the other way round, but it is a no-op
      // inside a transaction.
      await tx.run('PRAGMA defer_foreign_keys = ON;');

      for (const { name } of tables) {
        // The name comes from `sqlite_master`, not from user input, and is quoted regardless.
        await tx.run(`DELETE FROM "${name}";`);
      }
    });
  }

  private clearLocalState(): void {
    const storage = this.storage();
    if (storage === null) {
      return;
    }

    const keys = Object.keys(storage).filter((key) => key.startsWith(STORAGE_PREFIX));
    for (const key of keys) {
      storage.removeItem(key);
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
