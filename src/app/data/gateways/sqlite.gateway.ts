import { inject, Injectable } from '@angular/core';
import {
  SQLiteConnection,
  type SQLiteDBConnection,
  type capSQLiteVersionUpgrade,
} from '@capacitor-community/sqlite';

import { devicePlatform } from '@app/cross-cutting/infrastructure/device-platform';

import { DATABASE_VERSION, MIGRATIONS } from '../migrations/migrations';
import type { Migration } from '../migrations/migration';
import { CAPACITOR_SQLITE } from './capacitor-sqlite';
import { SqliteUnavailableError, type SqlValue, type SqliteDatabase } from './sqlite-database';

const DATABASE_NAME = 'rebellinnen-kalender';

/**
 * The application database.
 *
 * The only place `@capacitor-community/sqlite` is used. Everything above it depends on the
 * `SqliteDatabase` contract, so the plugin's types never reach a DAO, an interactor or a view.
 *
 * The connection is opened lazily on first use, not from an app initializer: nothing on the first
 * paint needs it, and a database that cannot open has to surface as an error inside the screen that
 * wanted it rather than aborting the bootstrap. The open promise is memoised, so concurrent callers
 * share one open sequence, and it is dropped again on failure so a retry can genuinely retry.
 */
@Injectable({ providedIn: 'root' })
export class SqliteGateway implements SqliteDatabase {
  private readonly plugin = inject(CAPACITOR_SQLITE);
  private readonly sqlite = new SQLiteConnection(this.plugin);
  protected readonly isWeb = devicePlatform() === 'web';

  private connection: Promise<SQLiteDBConnection> | null = null;

  async query<TRow>(statement: string, values: readonly SqlValue[] = []): Promise<TRow[]> {
    const database = await this.database();
    const result = await database.query(statement, [...values]);

    // `SQLiteDBConnection.query` already normalises the extra first row iOS returns, so the values
    // are plain row objects on every platform.
    return (result.values ?? []) as TRow[];
  }

  async run(statement: string, values: readonly SqlValue[] = []): Promise<void> {
    const database = await this.database();
    // `run` wraps the statement in a transaction by default, which is exactly the unit of work here.
    await database.run(statement, [...values]);

    if (this.isWeb) {
      // Without this the write only exists in memory: the web store copies the database into
      // IndexedDB when asked to, and that is what makes it survive a reload.
      await this.sqlite.saveToStore(DATABASE_NAME);
    }
  }

  private database(): Promise<SQLiteDBConnection> {
    this.connection ??= this.open().catch((cause: unknown) => {
      this.connection = null;
      throw new SqliteUnavailableError('Die Datenbank konnte nicht geöffnet werden.', { cause });
    });

    return this.connection;
  }

  /**
   * Overridable so a spec can exercise the open sequence without the `jeep-sqlite` element, which
   * needs a browser to define itself.
   */
  protected async initializeWebStore(): Promise<void> {
    const { initializeWebSqliteStore } = await import('./web-sqlite-store');
    await initializeWebSqliteStore(this.sqlite);
  }

  private async open(): Promise<SQLiteDBConnection> {
    if (this.isWeb) {
      await this.initializeWebStore();
    }

    // The plugin keeps its connections in a dictionary that outlives a page reload during
    // development: after an HMR update it still believes the connection exists, and
    // `createConnection` then fails. This reconciles the dictionary with reality first.
    await this.sqlite.checkConnectionsConsistency();

    // Registered before the connection is created, because `createConnection` is what applies the
    // upgrade to the requested version.
    await this.sqlite.addUpgradeStatement(DATABASE_NAME, MIGRATIONS.map(toUpgradeStatement));

    const existing = await this.sqlite.isConnection(DATABASE_NAME, false);
    const database =
      existing.result === true
        ? await this.sqlite.retrieveConnection(DATABASE_NAME, false)
        : await this.sqlite.createConnection(
            DATABASE_NAME,
            false,
            'no-encryption',
            DATABASE_VERSION,
            false,
          );

    await database.open();

    return database;
  }
}

function toUpgradeStatement(migration: Migration): capSQLiteVersionUpgrade {
  return { toVersion: migration.toVersion, statements: [...migration.statements] };
}
