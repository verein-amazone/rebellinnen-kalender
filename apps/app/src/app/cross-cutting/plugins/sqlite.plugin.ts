import { inject, InjectionToken } from '@angular/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  type CapacitorSQLitePlugin,
} from '@capacitor-community/sqlite';

/** The SQLite plugin object. See ./README.md for why it is behind a token. */
export const CAPACITOR_SQLITE = new InjectionToken<CapacitorSQLitePlugin>('CAPACITOR_SQLITE', {
  providedIn: 'root',
  factory: () => CapacitorSQLite,
});

/**
 * The plugin's connection wrapper. A second token rather than a `new` in the gateway: the class
 * comes out of the same package, so constructing it there would put the import back where the
 * token is meant to keep it out of. See ./README.md.
 */
export const SQLITE_CONNECTION = new InjectionToken<SQLiteConnection>('SQLITE_CONNECTION', {
  providedIn: 'root',
  factory: () => new SQLiteConnection(inject(CAPACITOR_SQLITE)),
});
