import { DatabaseSync } from 'node:sqlite';

import type { Migration } from '../migrations/migration';
import type { SqlValue, SqliteDatabase } from './sqlite-database';

/**
 * A `SqliteDatabase` backed by Node's built-in SQLite, for tests.
 *
 * Node ships SQLite since v22, so the DAO specs run the handwritten SQL against a real engine
 * without a new dependency and without the Capacitor plugin, which has no implementation under jsdom.
 * The `.testing.ts` suffix keeps this file out of the application build; see tsconfig.app.json.
 */
export class InMemorySqliteDatabase implements SqliteDatabase {
  private readonly database = new DatabaseSync(':memory:');

  /** Applies migrations in order, the way the gateway lets the plugin apply them on a device. */
  migrate(migrations: readonly Migration[]): void {
    for (const migration of [...migrations].sort((a, b) => a.toVersion - b.toVersion)) {
      for (const statement of migration.statements) {
        this.database.exec(statement);
      }
    }
  }

  query<TRow>(statement: string, values: readonly SqlValue[] = []): Promise<TRow[]> {
    const rows = this.database.prepare(statement).all(...values) as TRow[];
    return Promise.resolve(rows);
  }

  run(statement: string, values: readonly SqlValue[] = []): Promise<void> {
    this.database.prepare(statement).run(...values);
    return Promise.resolve();
  }

  close(): void {
    this.database.close();
  }
}
