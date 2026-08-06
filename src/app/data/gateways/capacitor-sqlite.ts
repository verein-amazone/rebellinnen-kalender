import { InjectionToken } from '@angular/core';
import { CapacitorSQLite, type CapacitorSQLitePlugin } from '@capacitor-community/sqlite';

/**
 * The plugin object itself.
 *
 * Behind a token so `SqliteGateway` can be unit-tested against a stub: the real plugin has no
 * implementation in a jsdom environment, and calling it there fails in ways that say nothing about
 * the gateway.
 */
export const CAPACITOR_SQLITE = new InjectionToken<CapacitorSQLitePlugin>('CAPACITOR_SQLITE', {
  providedIn: 'root',
  factory: () => CapacitorSQLite,
});
