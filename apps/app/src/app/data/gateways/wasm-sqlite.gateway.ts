import { Injectable } from '@angular/core';
import type { Database, Sqlite3Static } from '@sqlite.org/sqlite-wasm';

import { assetUrl } from '@app/cross-cutting/helpers/asset-url';

import { MIGRATIONS } from '../migrations/migrations';
import { DATABASE_NAME } from './database-name';
import {
  SqliteUnavailableError,
  type SqlValue,
  type SqliteDatabase,
  type SqliteExecutor,
} from './sqlite-database';
import {
  SynchronousSqliteDatabase,
  upgradeSchema,
  type SynchronousSqliteEngine,
} from './synchronous-sqlite';
import { readSnapshot, writeSnapshot } from './web-sqlite-snapshot';

/** Where angular.json copies the engine's WebAssembly binary. */
const WASM_PATH = '/assets/sqlite3.wasm';

/**
 * The application database in the browser: `@sqlite.org/sqlite-wasm`, SQLite's own WebAssembly
 * build, on the main thread.
 *
 * The app ships to iOS and Android, where `SqliteGateway` runs the Capacitor plugin. The browser is
 * used for `ng serve` and the Playwright suite, and gets real SQLite here so the
 * handwritten SQL and the migrations a developer clicks through are the ones a phone runs. It is the
 * same engine generation as on a device - including FTS5, which the plugin's own web layer
 * (`jeep-sqlite` over an old `sql.js`) lacks; see docs/architecture/data-persistence.md.
 *
 * The database lives in memory and is saved as a whole into IndexedDB after every committed write
 * (`web-sqlite-snapshot.ts`), and restored from there on the next page load. Foreign keys are on,
 * as the plugin turns them on on a device.
 *
 * Opened lazily on first use and memoised, like the native gateway: a database that cannot open has
 * to surface inside the screen that wanted it, and a retry must genuinely retry. The engine module is
 * loaded with a dynamic import, so a native build never fetches it.
 */
@Injectable({ providedIn: 'root' })
export class WasmSqliteGateway implements SqliteDatabase {
  private connection: Promise<SqliteDatabase> | null = null;

  async query<TRow>(statement: string, values?: readonly SqlValue[]): Promise<TRow[]> {
    return (await this.database()).query<TRow>(statement, values);
  }

  async run(statement: string, values?: readonly SqlValue[]): Promise<void> {
    await (await this.database()).run(statement, values);
  }

  async transaction<T>(work: (tx: SqliteExecutor) => Promise<T>): Promise<T> {
    return (await this.database()).transaction(work);
  }

  private database(): Promise<SqliteDatabase> {
    this.connection ??= this.open().catch((cause: unknown) => {
      this.connection = null;
      throw new SqliteUnavailableError('Die Datenbank konnte nicht geöffnet werden.', { cause });
    });

    return this.connection;
  }

  private async open(): Promise<SqliteDatabase> {
    const sqlite3 = await loadEngine();
    const database = new sqlite3.oo1.DB(':memory:');

    const snapshot = await readSnapshot(DATABASE_NAME);
    if (snapshot !== null) {
      restore(sqlite3, database, snapshot);
    }

    const engine = engineFor(database);
    engine.exec('PRAGMA foreign_keys = ON;');
    upgradeSchema(engine, MIGRATIONS);

    const save = () => writeSnapshot(DATABASE_NAME, sqlite3.capi.sqlite3_js_db_export(database));
    // A fresh or just-upgraded schema has to survive a reload before the first write does.
    await save();

    const connection = new SynchronousSqliteDatabase(engine, save);
    exposeForEndToEndTests(connection);
    return connection;
  }
}

/**
 * The module's typings declare its init function without parameters (see sqlite/sqlite-wasm#129),
 * but the Emscripten options are still honoured. `locateFile` is the one needed: the bundler does
 * not rewrite the module's `new URL('sqlite3.wasm', import.meta.url)`, so the binary is copied as an
 * asset and resolved against the base href like every other one (see `assetUrl`).
 */
async function loadEngine(): Promise<Sqlite3Static> {
  const { default: init } = await import('@sqlite.org/sqlite-wasm');
  const initWithOptions = init as unknown as (options: {
    readonly locateFile: (file: string) => string;
  }) => Promise<Sqlite3Static>;

  return initWithOptions({ locateFile: () => assetUrl(WASM_PATH) });
}

/** Replaces the empty in-memory database with a saved file. SQLite takes ownership of the copy. */
function restore(sqlite3: Sqlite3Static, database: Database, bytes: Uint8Array): void {
  const pointer = sqlite3.wasm.allocFromTypedArray(bytes);
  const result = sqlite3.capi.sqlite3_deserialize(
    database.pointer!,
    'main',
    pointer,
    bytes.byteLength,
    bytes.byteLength,
    sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE | sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE,
  );
  database.checkRc(result);
}

function engineFor(database: Database): SynchronousSqliteEngine {
  return {
    exec: (statement) => {
      database.exec(statement);
    },
    all: (statement, values) =>
      database.exec({
        sql: statement,
        bind: values.length > 0 ? [...values] : undefined,
        rowMode: 'object',
        returnValue: 'resultRows',
      }),
    run: (statement, values) => {
      database.exec({ sql: statement, bind: values.length > 0 ? [...values] : undefined });
    },
  };
}

/**
 * The seam `e2e/support/calendar-seed.ts` seeds rows through, for flows that have no screen to
 * create their data. Only under automation (`navigator.webdriver`), so no other browser session carries
 * a global write handle. It shares the app's serialization lock and saves like any other write.
 */
function exposeForEndToEndTests(database: SqliteExecutor): void {
  if (navigator.webdriver) {
    (globalThis as { rkWebSqlite?: SqliteExecutor }).rkWebSqlite = database;
  }
}
