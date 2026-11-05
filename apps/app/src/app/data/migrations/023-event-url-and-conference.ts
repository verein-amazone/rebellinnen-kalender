import type { Migration } from './migration';

/**
 * Adds an event's web address and its online meeting's join link (`docs/architecture/online-meetings.md`):
 *
 * - `ics_items.url` and `ics_items.conference_url`: the feed's `URL`, and the join link from
 *   `CONFERENCE` or a vendor property such as `X-GOOGLE-CONFERENCE`.
 * - `occurrences.url` and `occurrences.conference_url`: the same per row, plus iOS's `EKEvent.url`
 *   for device rows.
 *
 * The new columns start empty. The occurrence rows are refilled by the rebuild the bumped row
 * revision triggers (`ROW_REVISION`) and by the next device sync, whose fingerprint now covers the
 * URL. The ICS items can only be refilled from the feed, so the conditional-request metadata is
 * cleared: the next regular refresh downloads each feed in full instead of accepting a
 * `304 Not Modified`, and re-parses it.
 *
 * Both tables are rebuilt rather than altered, for the reason `020-rebuild-content-items.ts` gives: a
 * second `ALTER TABLE … ADD COLUMN` fails on the column the first one added, and a migration has to
 * survive running twice. The copy names only the columns both shapes share, so it works on either.
 * Dropping a table drops its indexes, so the occurrence indexes are created again.
 */
export const ADD_EVENT_URL_AND_CONFERENCE: Migration = {
  toVersion: 23,
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
      conference_url  TEXT
    );`,
    `INSERT OR REPLACE INTO occurrences_next (id, source_id, source_type, calendar_id, series_id,
      original_start, provenance, item_kind, title, location, is_all_day, start_kind, start_value,
      start_tz, end_kind, end_value, end_tz, start_utc, end_utc, start_local_day, end_local_day,
      external_id, item_id, description)
     SELECT id, source_id, source_type, calendar_id, series_id, original_start, provenance,
      item_kind, title, location, is_all_day, start_kind, start_value, start_tz, end_kind,
      end_value, end_tz, start_utc, end_utc, start_local_day, end_local_day, external_id, item_id,
      description
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
      PRIMARY KEY (subscription_id, uid)
    );`,
    `INSERT OR REPLACE INTO ics_items_next (subscription_id, uid, revision_id, kind, title,
      location, note, start_kind, start_value, start_tz, end_kind, end_value, end_tz, rrule)
     SELECT subscription_id, uid, revision_id, kind, title, location, note, start_kind,
      start_value, start_tz, end_kind, end_value, end_tz, rrule
     FROM ics_items;`,
    `DROP TABLE IF EXISTS ics_items;`,
    `ALTER TABLE ics_items_next RENAME TO ics_items;`,

    `UPDATE ics_subscriptions SET etag = NULL, last_modified = NULL;`,
  ],
};
