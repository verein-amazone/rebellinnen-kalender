import type { Migration } from './migration';

/**
 * The materialized occurrence layer and its coverage tracking (#29).
 *
 * `occurrences` holds one row per concrete instance across all source types — the single table
 * every range query reads. Rows are **derived and disposable**: deleting and rebuilding them must
 * always be possible from the canonical app items, the normalized ICS data, or a fresh device
 * query. That is why the table has no foreign keys and no timestamps of its own — it is a cache,
 * and the unit of work that rebuilds it owns its consistency.
 *
 * `start_utc`/`end_utc` (end exclusive) are the computed keys for interval-overlap queries;
 * `start_local_day`/`end_local_day` bucket all-day rows by device-zone days. `original_start` is
 * the occurrence's identity inside its series; `start_*` its effective time after overrides.
 *
 * `source_coverage` records the window a source's rows currently cover and which recurrence
 * engine generated them, and is written in the same transaction as the rows — coverage never
 * claims data that did not commit.
 */
export const CREATE_OCCURRENCES: Migration = {
  toVersion: 5,
  statements: [
    `CREATE TABLE IF NOT EXISTS occurrences (
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
      external_id     TEXT
    );`,
    `CREATE INDEX IF NOT EXISTS idx_occurrences_range ON occurrences (start_utc, end_utc);`,
    `CREATE INDEX IF NOT EXISTS idx_occurrences_source ON occurrences (source_id, start_utc);`,
    `CREATE INDEX IF NOT EXISTS idx_occurrences_series ON occurrences (series_id);`,
    `CREATE TABLE IF NOT EXISTS source_coverage (
      source_id        TEXT PRIMARY KEY NOT NULL,
      window_start_utc TEXT NOT NULL,
      window_end_utc   TEXT NOT NULL,
      engine_version   TEXT NOT NULL,
      updated_at       TEXT NOT NULL
    );`,
  ],
};
