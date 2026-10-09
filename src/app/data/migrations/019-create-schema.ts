import type { Migration } from './migration';

/**
 * The 1.0.0 schema in one step: every table, created in its final shape.
 *
 * Versions 1-18 were the pre-release history - a table at a time, then a column at a time. They
 * were squashed into this migration before 1.0.0 (#32), so a fresh install creates the schema
 * directly instead of replaying eighteen steps.
 *
 * **Why version 19 and not 1.** TestFlight and Play internal-testing builds already left databases
 * at every version from 1 to 18 on testers' devices, and the plugin only ever upgrades: a device at
 * version 18 asked for version 1 would open its database unchanged and never apply a later
 * migration again. Numbering this migration above every pre-release version is what makes each of
 * those devices run it.
 *
 * **Why it starts by dropping everything.** A tester's database may stop at any of those versions,
 * so its tables can be missing columns, or missing entirely. Rather than reconstructing eighteen
 * upgrade paths, the pre-release data is discarded and the schema recreated - agreed for the
 * pre-release builds, where nothing on a device is meant to survive 1.0.0. On a fresh install the
 * drops find nothing and do nothing. Children are dropped before the tables they reference, because
 * the plugin turns `PRAGMA foreign_keys` on and a `DROP TABLE` first deletes its rows.
 *
 * From 1.0.0 on the usual rule applies: this migration is never edited again, and the next schema
 * change is version 20.
 */
export const CREATE_SCHEMA: Migration = {
  toVersion: 19,
  statements: [
    `DROP TABLE IF EXISTS bookmarks;`,
    `DROP TABLE IF EXISTS content_items;`,
    `DROP TABLE IF EXISTS app_item_exceptions;`,
    `DROP TABLE IF EXISTS app_items;`,
    `DROP TABLE IF EXISTS calendars;`,
    `DROP TABLE IF EXISTS calendar_sources;`,
    `DROP TABLE IF EXISTS occurrences;`,
    `DROP TABLE IF EXISTS source_coverage;`,
    `DROP TABLE IF EXISTS ics_item_exceptions;`,
    `DROP TABLE IF EXISTS ics_items;`,
    `DROP TABLE IF EXISTS ics_subscriptions;`,
    `DROP TABLE IF EXISTS reminders;`,

    // The „Nicht vergessen“ list.
    //
    // `completed_at` is the single source of truth for the completion state - `NULL` means open. A
    // separate boolean column could disagree with the timestamp, so there is none.
    //
    // `position` is the user's manual order, and a `REAL` on purpose: dropping an entry between two
    // others writes the midpoint of their positions, a single-row `UPDATE` that is atomic without a
    // transaction. Renumbering a whole section is the rare fallback and is one statement too (see
    // `ReminderDao.reassignPositions`). The index mirrors the one order the list is ever read in
    // (see `ReminderDao.listAll`).
    `CREATE TABLE reminders (
      id           TEXT PRIMARY KEY NOT NULL,
      text         TEXT NOT NULL,
      completed_at TEXT,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL,
      position     REAL NOT NULL DEFAULT 0
    );`,
    `CREATE INDEX idx_reminders_order ON reminders ((completed_at IS NULL) DESC, position ASC);`,

    // Calendar sources and their calendars - the top of the calendar schema (#29).
    //
    // A source is where calendar data comes from: the app's own database (`app`), the operating
    // system's calendar store (`device`), or a subscribed ICS feed (`ics`). A calendar is one named
    // calendar inside a source. App calendars are authoritative rows; device calendars are a cached
    // snapshot of what the OS reported and carry the platform's calendar id in `external_id`; each
    // ICS subscription owns exactly one calendar.
    //
    // `state` tracks whether the source's data is trustworthy right now: `ok`, `stale` (a refresh
    // failed, cached data still shown), `error` (never had valid data or repeatedly failing), or
    // `permission-lost` (device access was revoked; the cache is kept but flagged).
    //
    // `native_source_id`/`native_source_name` identify the native account a device calendar came
    // from (iCloud, a Google account, Exchange, …) - `Calendar.source` on iOS,
    // `Calendar.accountName` on Android. `NULL` for app and ICS calendars.
    //
    // Foreign keys are declared for documentation but not relied upon - the plugin does not
    // guarantee `PRAGMA foreign_keys` on every platform, so cascading cleanups are explicit
    // statements in the unit of work that deletes a source.
    `CREATE TABLE calendar_sources (
      id          TEXT PRIMARY KEY NOT NULL,
      type        TEXT NOT NULL CHECK (type IN ('app', 'device', 'ics')),
      name        TEXT NOT NULL,
      enabled     INTEGER NOT NULL DEFAULT 1,
      state       TEXT NOT NULL DEFAULT 'ok'
                  CHECK (state IN ('ok', 'stale', 'error', 'permission-lost')),
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );`,
    `CREATE TABLE calendars (
      id                 TEXT PRIMARY KEY NOT NULL,
      source_id          TEXT NOT NULL REFERENCES calendar_sources (id),
      name               TEXT NOT NULL,
      color              TEXT,
      emoji              TEXT,
      enabled            INTEGER NOT NULL DEFAULT 1,
      writable           INTEGER NOT NULL DEFAULT 0,
      external_id        TEXT,
      created_at         TEXT NOT NULL,
      updated_at         TEXT NOT NULL,
      native_source_id   TEXT,
      native_source_name TEXT
    );`,
    `CREATE INDEX idx_calendars_source ON calendars (source_id);`,

    // Canonical app-owned calendar items and their occurrence exceptions (#29).
    //
    // An `app_items` row is authoritative: a standalone event or todo, or the master of a recurring
    // series when `rrule` is set. Start and end are stored as a lossless temporal triple
    // (`*_kind`/`*_value`/`*_tz`, see `TemporalValue`) so date-only, zoned, floating and UTC forms
    // round-trip exactly. A `date` end names the last day the item covers, not the day after.
    // `predecessor_series_id` links a continuation series to the series it was split off from.
    // `rule_revision` increments whenever the recurrence pattern changes, so derived rows can tell
    // which revision they were generated from.
    //
    // `reminders` (#81) is a JSON array of minutes before the start - `[15, 1440]` - or `NULL` for
    // „follow the default reminders in the settings“. An empty array is an explicit „no reminder“,
    // distinct from `NULL`. Minutes, not instants, so a moved appointment or a recurring series
    // needs no rewrite; the scheduler resolves them per occurrence.
    //
    // An `app_item_exceptions` row is the deliberate difference of one occurrence, keyed by the
    // series and the occurrence's original start - its identity even after being moved. `status` is
    // either `override` (the nullable replacement fields apply on top of the master; NULL inherits)
    // or `cancelled` (the occurrence does not happen). Exceptions are authoritative; generated
    // occurrence rows never are.
    `CREATE TABLE app_items (
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
      updated_at            TEXT NOT NULL,
      reminders             TEXT
    );`,
    `CREATE INDEX idx_app_items_calendar ON app_items (calendar_id);`,
    `CREATE TABLE app_item_exceptions (
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

    // The materialized occurrence layer and its coverage tracking (#29).
    //
    // `occurrences` holds one row per concrete instance across all source types - the single table
    // every range query reads. Rows are derived and disposable: deleting and rebuilding them must
    // always be possible from the canonical app items, the normalized ICS data, or a fresh device
    // query. That is why the table has no foreign keys and no timestamps of its own - it is a cache,
    // and the unit of work that rebuilds it owns its consistency.
    //
    // `start_utc`/`end_utc` (end exclusive) are the computed keys for interval-overlap queries;
    // `start_local_day`/`end_local_day` bucket all-day rows by device-zone days. `original_start` is
    // the occurrence's identity inside its series; `start_*` its effective time after overrides.
    // `item_id` is the app item a row came from (#19), so the editing flow can jump straight to its
    // canonical record; `NULL` for device and ICS rows. `description` carries a device event's notes
    // to the read-only detail view; only device rows populate it.
    //
    // `source_coverage` records the window a source's rows currently cover and which recurrence
    // engine generated them, and is written in the same transaction as the rows - coverage never
    // claims data that did not commit. `content_fingerprint` is a digest of the external data the
    // rows were built from, so a refresh that would rebuild exactly what is there can be skipped.
    // Only the device source sets it; app and ICS rows come from this database and leave it `NULL`.
    `CREATE TABLE occurrences (
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
      description     TEXT
    );`,
    `CREATE INDEX idx_occurrences_range ON occurrences (start_utc, end_utc);`,
    `CREATE INDEX idx_occurrences_source ON occurrences (source_id, start_utc);`,
    `CREATE INDEX idx_occurrences_series ON occurrences (series_id);`,
    `CREATE TABLE source_coverage (
      source_id           TEXT PRIMARY KEY NOT NULL,
      window_start_utc    TEXT NOT NULL,
      window_end_utc      TEXT NOT NULL,
      engine_version      TEXT NOT NULL,
      updated_at          TEXT NOT NULL,
      content_fingerprint TEXT
    );`,

    // ICS subscriptions and their normalized read-only calendar data (#29).
    //
    // `ics_subscriptions` is authoritative configuration plus the retained snapshot of the last
    // valid download: the URL (sensitive - it may carry access tokens; it is never logged in full,
    // see `redactIcsUrl`), HTTP cache metadata for conditional requests, refresh bookkeeping, and
    // the raw ICS text of the last successful revision so derived data can be rebuilt offline after
    // parser or engine fixes. `curated_id` correlates a subscription with its curated catalog entry
    // (#2) and is `NULL` for one the user added. `last_checked_at` is when the feed was last
    // confirmed current - a `304 Not Modified` counts - as opposed to when its content last changed
    // (`last_success_at`); the automatic refresh is gated on the former.
    //
    // `ics_items`/`ics_item_exceptions` are the normalized representation of the active revision:
    // recurring masters with their RFC 5545 rule, plus overrides (RECURRENCE-ID) and cancellations
    // (EXDATE) keyed by the occurrence's original start. They are derived from the feed but retained
    // - only a fully validated new revision may replace them, so a failed refresh can never take the
    // offline copy away.
    `CREATE TABLE ics_subscriptions (
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
      updated_at         TEXT NOT NULL,
      curated_id         TEXT,
      last_checked_at    TEXT
    );`,
    `CREATE TABLE ics_items (
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
    `CREATE TABLE ics_item_exceptions (
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

    // The Today page's daily impulse (#1): „Wissen & Impulse“ pieces and „Rebell*in“ portraits,
    // plus the bookmarks the collection is built from.
    //
    // `valid_from`/`valid_to` are ISO dates from the source's `Ausspielungszeitraum`; both `NULL`
    // means evergreen. `eligible_for_daily` mirrors the source's daily-impulse flag.
    // `related_sources` is a JSON array of `{ title, url }` for „Mehr zum Thema“ (#22). `image_alt`
    // describes the picture for people who cannot see it - `image_attribution` credits it, which is
    // not the same thing. `daily_render` is how the item renders as today's impulse: `image` leads
    // with the picture, `teaser` (and `NULL`) with the teaser line.
    //
    // `content_items` is never seeded here. The catalog is editorial content that changes far more
    // often than the schema, so it ships as a versioned JSON asset (`public/content/catalog.json`)
    // that `ContentCatalogSync` reconciles into this table at runtime.
    //
    // `bookmarks` holds one row per bookmarked item, keyed by the item itself.
    `CREATE TABLE content_items (
      id                 TEXT PRIMARY KEY NOT NULL,
      kind               TEXT NOT NULL CHECK (kind IN ('wissensimpulse', 'rebellin')),
      title              TEXT NOT NULL,
      teaser             TEXT NOT NULL,
      body_markdown      TEXT NOT NULL,
      image_path         TEXT,
      image_attribution  TEXT,
      source_label       TEXT,
      source_url         TEXT,
      valid_from         TEXT,
      valid_to           TEXT,
      eligible_for_daily INTEGER NOT NULL DEFAULT 0,
      related_sources    TEXT,
      image_alt          TEXT,
      daily_render       TEXT
    );`,
    `CREATE TABLE bookmarks (
      content_item_id TEXT PRIMARY KEY NOT NULL REFERENCES content_items (id),
      created_at      TEXT NOT NULL
    );`,
  ],
};
