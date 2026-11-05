import type { Migration } from './migration';

/**
 * Adds a synced event's own reminders, so the app can remind of device and ICS appointments too
 * (`docs/architecture/data-persistence.md`, „Reminders“):
 *
 * - `ics_items.reminders`: the minutes before the start from the feed's `VALARM`s.
 * - `ics_item_exceptions.reminders`: an override's own `VALARM`s, where it has any.
 * - `occurrences.reminders`: the same per row, plus a device event's alerts for device rows.
 *
 * All are a JSON array like `app_items.reminders`, `NULL` for „none of its own“. They start empty
 * and are refilled the way `023-event-url-and-conference.ts` refilled its columns: the occurrence
 * rows by the rebuild the bumped row revision triggers (`ROW_REVISION`) and by the next device sync,
 * whose fingerprint now covers the reminders; the ICS items by the next refresh, which downloads
 * each feed in full because the conditional-request metadata is cleared.
 *
 * Unlike version 23, that refresh is also made due right away: until it runs, a feed's appointments
 * would remind at the default times instead of their own, for up to the six hours the automatic
 * refresh waits. `last_checked_at` is set to the epoch rather than cleared - a cleared one falls
 * back to `last_success_at`, which is recent - and `last_success_at` stays, since a failed refresh
 * reads it to tell a stale feed from one that never loaded.
 *
 * Rebuilt rather than altered, and indexes recreated, for the reasons version 23 gives.
 */
export const ADD_SYNCED_EVENT_REMINDERS: Migration = {
  toVersion: 24,
  statements: [
    `CREATE TABLE IF NOT EXISTS occurrences_next (
      id              TEXT PRIMARY KEY NOT NULL,
      source_id       TEXT NOT NULL,
      source_type     TEXT NOT NULL CHECK (source_type IN ('app', 'device', 'ics')),
      calendar_id     TEXT NOT NULL,
      series_id       TEXT,
      original_start  TEXT,
      provenance      TEXT NOT NULL
                      CHECK (provenance IN ('standalone', 'generated', 'overridden', 'device-cached')),
      item_kind       TEXT NOT NULL CHECK (item_kind IN ('event', 'todo')),
      title           TEXT NOT NULL,
      location        TEXT,
      is_all_day      INTEGER NOT NULL DEFAULT 0,
      start_kind      TEXT NOT NULL CHECK (start_kind IN ('date', 'zoned', 'floating', 'utc')),
      start_value     TEXT NOT NULL,
      start_tz        TEXT,
      end_kind        TEXT CHECK (end_kind IN ('date', 'zoned', 'floating', 'utc')),
      end_value       TEXT,
      end_tz          TEXT,
      start_utc       TEXT NOT NULL,
      end_utc         TEXT NOT NULL,
      start_local_day TEXT NOT NULL,
      end_local_day   TEXT NOT NULL,
      external_id     TEXT,
      item_id         TEXT,
      description     TEXT,
      url             TEXT,
      conference_url  TEXT,
      reminders       TEXT
    );`,
    `INSERT OR REPLACE INTO occurrences_next (id, source_id, source_type, calendar_id, series_id,
      original_start, provenance, item_kind, title, location, is_all_day, start_kind, start_value,
      start_tz, end_kind, end_value, end_tz, start_utc, end_utc, start_local_day, end_local_day,
      external_id, item_id, description, url, conference_url)
     SELECT id, source_id, source_type, calendar_id, series_id, original_start, provenance,
      item_kind, title, location, is_all_day, start_kind, start_value, start_tz, end_kind,
      end_value, end_tz, start_utc, end_utc, start_local_day, end_local_day, external_id, item_id,
      description, url, conference_url
     FROM occurrences;`,
    `DROP TABLE IF EXISTS occurrences;`,
    `ALTER TABLE occurrences_next RENAME TO occurrences;`,
    `CREATE INDEX IF NOT EXISTS idx_occurrences_range ON occurrences (start_utc, end_utc);`,
    `CREATE INDEX IF NOT EXISTS idx_occurrences_source ON occurrences (source_id, start_utc);`,
    `CREATE INDEX IF NOT EXISTS idx_occurrences_series ON occurrences (series_id);`,

    `CREATE TABLE IF NOT EXISTS ics_items_next (
      subscription_id TEXT NOT NULL,
      uid             TEXT NOT NULL,
      revision_id     TEXT NOT NULL,
      kind            TEXT NOT NULL CHECK (kind IN ('event', 'todo')),
      title           TEXT NOT NULL,
      location        TEXT,
      note            TEXT,
      start_kind      TEXT NOT NULL CHECK (start_kind IN ('date', 'zoned', 'floating', 'utc')),
      start_value     TEXT NOT NULL,
      start_tz        TEXT,
      end_kind        TEXT CHECK (end_kind IN ('date', 'zoned', 'floating', 'utc')),
      end_value       TEXT,
      end_tz          TEXT,
      rrule           TEXT,
      url             TEXT,
      conference_url  TEXT,
      reminders       TEXT,
      PRIMARY KEY (subscription_id, uid)
    );`,
    `INSERT OR REPLACE INTO ics_items_next (subscription_id, uid, revision_id, kind, title,
      location, note, start_kind, start_value, start_tz, end_kind, end_value, end_tz, rrule, url,
      conference_url)
     SELECT subscription_id, uid, revision_id, kind, title, location, note, start_kind,
      start_value, start_tz, end_kind, end_value, end_tz, rrule, url, conference_url
     FROM ics_items;`,
    `DROP TABLE IF EXISTS ics_items;`,
    `ALTER TABLE ics_items_next RENAME TO ics_items;`,

    `CREATE TABLE IF NOT EXISTS ics_item_exceptions_next (
      subscription_id TEXT NOT NULL,
      uid             TEXT NOT NULL,
      original_start  TEXT NOT NULL,
      revision_id     TEXT NOT NULL,
      status          TEXT NOT NULL CHECK (status IN ('override', 'cancelled')),
      title           TEXT,
      location        TEXT,
      note            TEXT,
      start_kind      TEXT CHECK (start_kind IN ('date', 'zoned', 'floating', 'utc')),
      start_value     TEXT,
      start_tz        TEXT,
      end_kind        TEXT CHECK (end_kind IN ('date', 'zoned', 'floating', 'utc')),
      end_value       TEXT,
      end_tz          TEXT,
      reminders       TEXT,
      PRIMARY KEY (subscription_id, uid, original_start)
    );`,
    `INSERT OR REPLACE INTO ics_item_exceptions_next (subscription_id, uid, original_start,
      revision_id, status, title, location, note, start_kind, start_value, start_tz, end_kind,
      end_value, end_tz)
     SELECT subscription_id, uid, original_start, revision_id, status, title, location, note,
      start_kind, start_value, start_tz, end_kind, end_value, end_tz
     FROM ics_item_exceptions;`,
    `DROP TABLE IF EXISTS ics_item_exceptions;`,
    `ALTER TABLE ics_item_exceptions_next RENAME TO ics_item_exceptions;`,

    `UPDATE ics_subscriptions SET etag = NULL, last_modified = NULL,
      last_checked_at = '1970-01-01T00:00:00Z';`,
  ],
};
