import type { Migration } from './migration';

/**
 * Adds the appointment reminders (#81).
 *
 * A JSON array of minutes before the start - `[15, 1440]` - or `NULL` for „follow the default
 * reminders in the settings“, which every existing row keeps. An empty array is an explicit „no
 * reminder“, distinct from `NULL`. Minutes, not instants, so a moved appointment or a recurring
 * series needs no rewrite; the scheduler resolves them per occurrence.
 */
export const ADD_APP_ITEM_REMINDERS: Migration = {
  toVersion: 18,
  statements: [`ALTER TABLE app_items ADD COLUMN reminders TEXT;`],
};
