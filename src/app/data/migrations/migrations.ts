import { CREATE_REMINDERS } from './001-create-reminders';
import { ADD_REMINDER_POSITION } from './002-add-reminder-position';
import type { Migration } from './migration';

/**
 * Every schema version the app has ever shipped, ordered by `toVersion`.
 *
 * Never edit a migration that has shipped: a device that already applied it will not run it again,
 * so the edit would only affect fresh installs and the two would drift apart. Add a new migration
 * with the next `toVersion` instead.
 */
export const MIGRATIONS: readonly Migration[] = [CREATE_REMINDERS, ADD_REMINDER_POSITION];

/** The version a freshly opened database is upgraded to. Derived, so it cannot fall behind. */
export const DATABASE_VERSION = MIGRATIONS.reduce(
  (highest, migration) => Math.max(highest, migration.toVersion),
  0,
);
