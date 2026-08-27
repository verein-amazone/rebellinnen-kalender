import type { Migration } from './migration';

/**
 * Calendar sources and their calendars - the top of the calendar schema (#29).
 *
 * A **source** is where calendar data comes from: the app's own database (`app`), the operating
 * system's calendar store (`device`), or a subscribed ICS feed (`ics`). A **calendar** is one
 * named calendar inside a source. App calendars are authoritative rows; device calendars are a
 * cached snapshot of what the OS reported and carry the platform's calendar id in `external_id`;
 * each ICS subscription owns exactly one calendar.
 *
 * `state` tracks whether the source's data is trustworthy right now: `ok`, `stale` (a refresh
 * failed, cached data still shown), `error` (never had valid data or repeatedly failing), or
 * `permission-lost` (device access was revoked; the cache is kept but flagged).
 *
 * Foreign keys are declared for documentation but not relied upon - the plugin does not guarantee
 * `PRAGMA foreign_keys` on every platform, so cascading cleanups are explicit statements in the
 * unit of work that deletes a source.
 */
export const CREATE_CALENDAR_SOURCES: Migration = {
  toVersion: 3,
  statements: [
    `CREATE TABLE IF NOT EXISTS calendar_sources (
      id          TEXT PRIMARY KEY NOT NULL,
      type        TEXT NOT NULL CHECK (type IN ('app', 'device', 'ics')),
      name        TEXT NOT NULL,
      enabled     INTEGER NOT NULL DEFAULT 1,
      state       TEXT NOT NULL DEFAULT 'ok'
                  CHECK (state IN ('ok', 'stale', 'error', 'permission-lost')),
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS calendars (
      id          TEXT PRIMARY KEY NOT NULL,
      source_id   TEXT NOT NULL REFERENCES calendar_sources (id),
      name        TEXT NOT NULL,
      color       TEXT,
      emoji       TEXT,
      enabled     INTEGER NOT NULL DEFAULT 1,
      writable    INTEGER NOT NULL DEFAULT 0,
      external_id TEXT,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_calendars_source ON calendars (source_id);`,
  ],
};
