import type { Migration } from './migration';

/**
 * Canonical app-owned calendar items and their occurrence exceptions (#29).
 *
 * An `app_items` row is authoritative: a standalone event or todo, or the master of a recurring
 * series when `rrule` is set. Start and end are stored as a lossless temporal triple
 * (`*_kind`/`*_value`/`*_tz`, see `TemporalValue`) so date-only, zoned, floating and UTC forms
 * round-trip exactly. `predecessor_series_id` links a continuation series to the series it was
 * split off from. `rule_revision` increments whenever the recurrence pattern changes, so derived
 * rows can tell which revision they were generated from.
 *
 * An `app_item_exceptions` row is the deliberate difference of one occurrence, keyed by the series
 * and the occurrence's **original** start - its identity even after being moved. `status` is either
 * `override` (the nullable replacement fields apply on top of the master; NULL inherits) or
 * `cancelled` (the occurrence does not happen). Exceptions are authoritative; generated occurrence
 * rows never are.
 */
export const CREATE_APP_ITEMS: Migration = {
  toVersion: 4,
  statements: [
    `CREATE TABLE IF NOT EXISTS app_items (
      id                    TEXT PRIMARY KEY NOT NULL,
      calendar_id           TEXT NOT NULL REFERENCES calendars (id),
      kind                  TEXT NOT NULL CHECK (kind IN ('event', 'todo')),
      title                 TEXT NOT NULL,
      location              TEXT,
      note                  TEXT,
      start_kind            TEXT NOT NULL CHECK (start_kind IN ('date', 'zoned', 'floating', 'utc')),
      start_value           TEXT NOT NULL,
      start_tz              TEXT,
      end_kind              TEXT CHECK (end_kind IN ('date', 'zoned', 'floating', 'utc')),
      end_value             TEXT,
      end_tz                TEXT,
      rrule                 TEXT,
      predecessor_series_id TEXT,
      rule_revision         INTEGER NOT NULL DEFAULT 0,
      created_at            TEXT NOT NULL,
      updated_at            TEXT NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_app_items_calendar ON app_items (calendar_id);`,
    `CREATE TABLE IF NOT EXISTS app_item_exceptions (
      series_id      TEXT NOT NULL REFERENCES app_items (id),
      original_start TEXT NOT NULL,
      status         TEXT NOT NULL CHECK (status IN ('override', 'cancelled')),
      title          TEXT,
      location       TEXT,
      note           TEXT,
      start_kind     TEXT CHECK (start_kind IN ('date', 'zoned', 'floating', 'utc')),
      start_value    TEXT,
      start_tz       TEXT,
      end_kind       TEXT CHECK (end_kind IN ('date', 'zoned', 'floating', 'utc')),
      end_value      TEXT,
      end_tz         TEXT,
      created_at     TEXT NOT NULL,
      updated_at     TEXT NOT NULL,
      PRIMARY KEY (series_id, original_start)
    );`,
  ],
};
