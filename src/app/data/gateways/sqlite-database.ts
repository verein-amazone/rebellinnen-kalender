import { inject, InjectionToken } from '@angular/core';

import { SqliteGateway } from './sqlite.gateway';

/** The value types SQLite binds as a statement parameter. */
export type SqlValue = string | number | null;

/**
 * The database as everything above the gateway sees it: two methods, no plugin types.
 *
 * There is deliberately no `transaction()` yet. A single `run()` already executes inside its own
 * transaction, and no use case so far spans more than one statement. The method gets added together
 * with the first real unit of work that needs it, not before.
 */
export interface SqliteDatabase {
  query<TRow>(statement: string, values?: readonly SqlValue[]): Promise<TRow[]>;
  run(statement: string, values?: readonly SqlValue[]): Promise<void>;
}

/**
 * Thrown when the database cannot be opened at all — a failed migration, a missing plugin, a corrupt
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
