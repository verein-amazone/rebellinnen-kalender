/**
 * One schema version.
 *
 * This is our own type rather than the plugin's `capSQLiteVersionUpgrade`, so no Capacitor type
 * reaches the migrations. The gateway maps it when it hands the registry to the plugin.
 */
export interface Migration {
  /** The schema version this migration produces. The first migration goes to 1. */
  readonly toVersion: number;
  /** Executed in order, inside one transaction, when upgrading to `toVersion`. */
  readonly statements: readonly string[];
}
