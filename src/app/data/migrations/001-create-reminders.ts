import type { Migration } from './migration';

/**
 * The first schema version: the „Nicht vergessen“ list.
 *
 * `completed_at` is the single source of truth for the completion state - `NULL` means open. A
 * separate boolean column could disagree with the timestamp, so there is none.
 *
 * The index mirrors the one ordering the list is ever read in (see `ReminderDao.listAll`).
 */
export const CREATE_REMINDERS: Migration = {
  toVersion: 1,
  statements: [
    `CREATE TABLE IF NOT EXISTS reminders (
      id           TEXT PRIMARY KEY NOT NULL,
      text         TEXT NOT NULL,
      completed_at TEXT,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_reminders_order ON reminders (completed_at, created_at);`,
  ],
};
