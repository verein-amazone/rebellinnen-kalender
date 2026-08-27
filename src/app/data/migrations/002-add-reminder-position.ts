import type { Migration } from './migration';

/**
 * Gives every entry a manual position, so the list order is the user's and not the clock's.
 *
 * The position is a `REAL` on purpose. Dropping an entry between two others writes the midpoint of
 * their positions, which is a single-row `UPDATE` - and a single statement is already atomic, so the
 * database contract needs no transaction support for a reorder. Renumbering a whole section is the
 * rare fallback and is written as one statement too (see `ReminderDao.reassignPositions`).
 *
 * The backfill reproduces the order version 1 was read in, `(completed_at IS NULL) DESC,
 * created_at ASC`: the open/completed split is the query's leading key, so ranking only has to happen
 * inside a section. `id` breaks a tie between two identical timestamps so the result is
 * deterministic. Both sections start over at 1000, which is harmless because the sections are never
 * compared with each other.
 */
export const ADD_REMINDER_POSITION: Migration = {
  toVersion: 2,
  statements: [
    `ALTER TABLE reminders ADD COLUMN position REAL NOT NULL DEFAULT 0;`,
    // The subquery reads `completed_at`, `created_at` and `id`, none of which this statement writes,
    // so it cannot observe its own partial result. `(x IS NULL) = (y IS NULL)` compares two 0/1
    // integers and is therefore never NULL.
    `UPDATE reminders
      SET position = (
        SELECT COUNT(*) * 1000.0
        FROM reminders AS earlier
        WHERE (earlier.completed_at IS NULL) = (reminders.completed_at IS NULL)
          AND (
            earlier.created_at < reminders.created_at
            OR (earlier.created_at = reminders.created_at AND earlier.id <= reminders.id)
          )
      );`,
    // Replaced under the same name: the table still has exactly one index, and it still mirrors the
    // one order the list is ever read in (see `ReminderDao.listAll`).
    `DROP INDEX IF EXISTS idx_reminders_order;`,
    `CREATE INDEX IF NOT EXISTS idx_reminders_order
      ON reminders ((completed_at IS NULL) DESC, position ASC);`,
  ],
};
