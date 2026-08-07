import type { Migration } from './migration';

/**
 * ICS subscriptions and their normalized read-only calendar data (#29).
 *
 * `ics_subscriptions` is authoritative configuration plus the retained snapshot of the last valid
 * download: the URL (sensitive — it may carry access tokens; it is never logged in full, see
 * `redactIcsUrl`), HTTP cache metadata for conditional requests, refresh bookkeeping, and the raw
 * ICS text of the last successful revision so derived data can be rebuilt offline after parser or
 * engine fixes.
 *
 * `ics_items`/`ics_item_exceptions` are the normalized representation of the active revision:
 * recurring masters with their RFC 5545 rule, plus overrides (RECURRENCE-ID) and cancellations
 * (EXDATE) keyed by the occurrence's original start. They are derived from the feed but retained —
 * only a fully validated new revision may replace them, so a failed refresh can never take the
 * offline copy away.
 */
export const CREATE_ICS_SUBSCRIPTIONS: Migration = {
  toVersion: 6,
  statements: [
    `CREATE TABLE IF NOT EXISTS ics_subscriptions (
      id                 TEXT PRIMARY KEY NOT NULL,
      url                TEXT NOT NULL,
      allow_insecure     INTEGER NOT NULL DEFAULT 0,
      etag               TEXT,
      last_modified      TEXT,
      last_success_at    TEXT,
      last_attempt_at    TEXT,
      last_error         TEXT,
      active_revision_id TEXT,
      raw_ics            TEXT,
      created_at         TEXT NOT NULL,
      updated_at         TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS ics_items (
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
      PRIMARY KEY (subscription_id, uid)
    );`,
    `CREATE TABLE IF NOT EXISTS ics_item_exceptions (
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
      PRIMARY KEY (subscription_id, uid, original_start)
    );`,
  ],
};
