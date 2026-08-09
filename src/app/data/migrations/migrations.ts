import { CREATE_REMINDERS } from './001-create-reminders';
import { ADD_REMINDER_POSITION } from './002-add-reminder-position';
import { CREATE_CALENDAR_SOURCES } from './003-create-calendar-sources';
import { CREATE_APP_ITEMS } from './004-create-app-items';
import { CREATE_OCCURRENCES } from './005-create-occurrences';
import { CREATE_ICS_SUBSCRIPTIONS } from './006-create-ics-subscriptions';
import { ADD_OCCURRENCE_ITEM_ID } from './007-add-occurrence-item-id';
import type { Migration } from './migration';

/**
 * Every schema version the app has ever shipped, ordered by `toVersion`.
 *
 * Never edit a migration that has shipped: a device that already applied it will not run it again,
 * so the edit would only affect fresh installs and the two would drift apart. Add a new migration
 * with the next `toVersion` instead.
 */
export const MIGRATIONS: readonly Migration[] = [
  CREATE_REMINDERS,
  ADD_REMINDER_POSITION,
  CREATE_CALENDAR_SOURCES,
  CREATE_APP_ITEMS,
  CREATE_OCCURRENCES,
  CREATE_ICS_SUBSCRIPTIONS,
  ADD_OCCURRENCE_ITEM_ID,
];

/** The version a freshly opened database is upgraded to. Derived, so it cannot fall behind. */
export const DATABASE_VERSION = MIGRATIONS.reduce(
  (highest, migration) => Math.max(highest, migration.toVersion),
  0,
);
