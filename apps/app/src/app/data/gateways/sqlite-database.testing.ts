import { DatabaseSync } from 'node:sqlite';

import type { Migration } from '../migrations/migration';
import { SynchronousSqliteDatabase } from './synchronous-sqlite';

/**
 * A `SqliteDatabase` backed by Node's built-in SQLite, for tests.
 *
 * Node ships SQLite since v22, so the DAO specs run the handwritten SQL against a real engine
 * without a new dependency and without the Capacitor plugin, which has no implementation under jsdom.
 * The `.testing.ts` suffix keeps this file out of the application build; see tsconfig.app.json.
 *
 * Its statement, transaction and serialization semantics are `SynchronousSqliteDatabase`'s - the
 * very code the web build runs over `@sqlite.org/sqlite-wasm`.
 */
export class InMemorySqliteDatabase extends SynchronousSqliteDatabase {
  private readonly database: DatabaseSync;

  constructor() {
    const database = new DatabaseSync(':memory:');
    super({
      exec: (statement) => database.exec(statement),
      all: (statement, values) => database.prepare(statement).all(...values),
      run: (statement, values) => {
        database.prepare(statement).run(...values);
      },
    });
    this.database = database;
  }

  /**
   * Applies every given migration's statements in order, regardless of the version stamp - so a
   * spec can prove a migration survives running twice, which is what a crash between the plugin's
   * commit and its version stamp leads to on a device.
   */
  migrate(migrations: readonly Migration[]): void {
    for (const migration of [...migrations].sort((a, b) => a.toVersion - b.toVersion)) {
      for (const statement of migration.statements) {
        this.database.exec(statement);
      }
    }
  }

  close(): void {
    this.database.close();
  }
}
