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
import {
  SqliteUnavailableError,
  type SqlValue,
  type SqliteDatabase,
  type SqliteExecutor,
} from './sqlite-database';

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

  /**
   * Serializes statements and transactions on the single shared connection. Without it, a plain
   * `run()` issued while a transaction is open would join that transaction - and commit or roll
   * back with it - instead of being its own unit of work.
   */
  private lock: Promise<unknown> = Promise.resolve();

  async query<TRow>(statement: string, values: readonly SqlValue[] = []): Promise<TRow[]> {
    const database = await this.database();
    return this.serialized(async () => {
      const result = await database.query(statement, [...values]);

      // `SQLiteDBConnection.query` already normalises the extra first row iOS returns, so the values
      // are plain row objects on every platform.
      return (result.values ?? []) as TRow[];
    });
  }

  async run(statement: string, values: readonly SqlValue[] = []): Promise<void> {
    const database = await this.database();
    await this.serialized(async () => {
      // `run` wraps the statement in a transaction by default, which is exactly the unit of work
      // here.
      await database.run(statement, [...values]);
      await this.persistWebStore();
    });
  }

  async transaction<T>(work: (tx: SqliteExecutor) => Promise<T>): Promise<T> {
    const database = await this.database();
    return this.serialized(async () => {
      // Explicit BEGIN/COMMIT instead of the plugin's transaction methods: plain statements behave
      // identically on iOS, Android and jeep-sqlite, and IMMEDIATE takes the write lock up front so
      // the transaction cannot fail on upgrade halfway through.
      await database.execute('BEGIN IMMEDIATE;', false);

      try {
        const result = await work(transactionExecutorFor(database));
        await database.execute('COMMIT;', false);
        // One store write per transaction, after the commit - an aborted transaction must never
        // reach IndexedDB.
        await this.persistWebStore();
        return result;
      } catch (error) {
        try {
          await database.execute('ROLLBACK;', false);
        } catch {
          // The original error is the one worth surfacing; a failed rollback on an already-aborted
          // transaction adds nothing.
        }
        throw error;
      }
    });
  }

  /**
   * The web store copies the database into IndexedDB when asked to, and that is what makes a write
   * survive a reload. On native the file is the store, so there is nothing to do.
   */
  private async persistWebStore(): Promise<void> {
    if (this.isWeb) {
      await this.sqlite.saveToStore(DATABASE_NAME);
    }
  }

  private serialized<T>(work: () => Promise<T>): Promise<T> {
    const result = this.lock.then(work, work);
    this.lock = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
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

/**
 * The executor handed to a `transaction()` callback. Its statements run with the plugin's automatic
 * per-statement transaction switched off - they belong to the explicit BEGIN the gateway opened.
 */
function transactionExecutorFor(database: SQLiteDBConnection): SqliteExecutor {
  return {
    async query<TRow>(statement: string, values: readonly SqlValue[] = []): Promise<TRow[]> {
      const result = await database.query(statement, [...values]);
      return (result.values ?? []) as TRow[];
    },
    async run(statement: string, values: readonly SqlValue[] = []): Promise<void> {
      await database.run(statement, [...values], false);
    },
  };
}
