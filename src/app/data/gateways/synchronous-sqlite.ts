import type { Migration } from '../migrations/migration';
import type { SqlValue, SqliteDatabase, SqliteExecutor } from './sqlite-database';

/**
 * The three calls a synchronous, in-process SQLite binding offers, whatever binding it is.
 *
 * Two bindings implement it: `@sqlite.org/sqlite-wasm` on the web (`WasmSqliteGateway`) and Node's
 * built-in `node:sqlite` in the specs (`InMemorySqliteDatabase`). Both run the statement before the
 * call returns, so everything that makes them a `SqliteDatabase` - serialization, transactions,
 * migrations - is written once, in {@link SynchronousSqliteDatabase}, and the specs exercise the
 * same transaction logic the web build runs.
 */
export interface SynchronousSqliteEngine {
  /** Runs one or more statements without parameters and discards any result. */
  exec(statement: string): void;
  /** Runs one statement and returns its rows as plain objects keyed by column name. */
  all(statement: string, values: readonly SqlValue[]): unknown[];
  /** Runs one statement and discards any result. */
  run(statement: string, values: readonly SqlValue[]): void;
}

/**
 * A `SqliteDatabase` over a {@link SynchronousSqliteEngine}, with the native gateway's semantics.
 *
 * Statements and transactions are serialized on the one connection, the same way `SqliteGateway`
 * serializes them on the plugin's: a plain `run()` issued while a transaction is awaiting its
 * callback would otherwise join that transaction and commit or roll back with it. The same rule
 * follows from it as on a device - inside a `transaction()` callback only the passed executor may be
 * used.
 *
 * `afterWrite` runs after every successful `run()` and after every committed transaction, never
 * after a rolled-back one, and still inside the serialization lock. The web build uses it to save
 * the database; the specs leave it out.
 */
export class SynchronousSqliteDatabase implements SqliteDatabase {
  private lock: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly engine: SynchronousSqliteEngine,
    private readonly afterWrite: () => Promise<void> = () => Promise.resolve(),
  ) {}

  query<TRow>(statement: string, values: readonly SqlValue[] = []): Promise<TRow[]> {
    return this.serialized(async () => this.engine.all(statement, values) as TRow[]);
  }

  run(statement: string, values: readonly SqlValue[] = []): Promise<void> {
    return this.serialized(async () => {
      this.engine.run(statement, values);
      await this.afterWrite();
    });
  }

  transaction<T>(work: (tx: SqliteExecutor) => Promise<T>): Promise<T> {
    return this.serialized(async () => {
      // IMMEDIATE takes the write lock up front, as on a device - see `SqliteGateway.transaction`.
      this.engine.exec('BEGIN IMMEDIATE;');

      try {
        const result = await work(this.executor());
        this.engine.exec('COMMIT;');
        await this.afterWrite();
        return result;
      } catch (error) {
        try {
          this.engine.exec('ROLLBACK;');
        } catch {
          // The original error is the one worth surfacing; a failed rollback on an already-aborted
          // transaction adds nothing.
        }
        throw error;
      }
    });
  }

  /** The executor a transaction callback receives: the engine itself, outside the lock it holds. */
  private executor(): SqliteExecutor {
    return {
      query: async <TRow>(statement: string, values: readonly SqlValue[] = []) =>
        this.engine.all(statement, values) as TRow[],
      run: async (statement: string, values: readonly SqlValue[] = []) => {
        this.engine.run(statement, values);
      },
    };
  }

  private serialized<T>(work: () => Promise<T>): Promise<T> {
    const result = this.lock.then(work, work);
    this.lock = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

/**
 * Brings the schema up to the newest migration, the way the Capacitor plugin does on a device: the
 * current version is `PRAGMA user_version`, and every migration above it runs in order, each in one
 * transaction together with the version stamp, so a failed migration leaves the database on the
 * version before it.
 */
export function upgradeSchema(
  engine: SynchronousSqliteEngine,
  migrations: readonly Migration[],
): void {
  const [row] = engine.all('PRAGMA user_version;', []) as { readonly user_version: number }[];
  const current = row?.user_version ?? 0;

  for (const migration of [...migrations].sort((a, b) => a.toVersion - b.toVersion)) {
    if (migration.toVersion <= current) {
      continue;
    }

    engine.exec('BEGIN IMMEDIATE;');
    try {
      for (const statement of migration.statements) {
        engine.exec(statement);
      }
      // A pragma takes no bound parameters; `toVersion` is a number from our own source.
      engine.exec(`PRAGMA user_version = ${Math.trunc(migration.toVersion)};`);
      engine.exec('COMMIT;');
    } catch (error) {
      engine.exec('ROLLBACK;');
      throw error;
    }
  }
}
