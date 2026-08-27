import { inject, InjectionToken } from '@angular/core';

import { SqliteGateway } from './sqlite.gateway';

/** The value types SQLite binds as a statement parameter. */
export type SqlValue = string | number | null;

/**
 * The statement surface a DAO writes against: two methods, no plugin types. Outside a transaction
 * the database itself is the executor; inside one, `transaction()` hands the work callback an
 * executor bound to that transaction.
 */
export interface SqliteExecutor {
  query<TRow>(statement: string, values?: readonly SqlValue[]): Promise<TRow[]>;
  run(statement: string, values?: readonly SqlValue[]): Promise<void>;
}

/**
 * The database as everything above the gateway sees it.
 *
 * `transaction()` runs the callback as one atomic unit of work: every statement issued through the
 * given executor commits together or not at all. Transactions are serialized - the database is a
 * single shared connection - so inside the callback only the passed executor may be used; calling
 * the database directly from within would deadlock on the serialization lock.
 */
export interface SqliteDatabase extends SqliteExecutor {
  transaction<T>(work: (tx: SqliteExecutor) => Promise<T>): Promise<T>;
}

/**
 * Thrown when the database cannot be opened at all - a failed migration, a missing plugin, a corrupt
 * file. It carries no plugin detail, so callers can surface it without leaking Capacitor types.
 */
export class SqliteUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SqliteUnavailableError';
  }
}

/**
 * Injected by DAOs instead of the gateway class, so a spec can substitute an in-memory database with
 * a single provider and never touch the Capacitor plugin.
 */
export const SQLITE_DATABASE = new InjectionToken<SqliteDatabase>('SQLITE_DATABASE', {
  providedIn: 'root',
  factory: () => inject(SqliteGateway),
});
