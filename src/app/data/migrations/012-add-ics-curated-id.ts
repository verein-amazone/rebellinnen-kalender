import type { Migration } from './migration';

/**
 * Correlates an ICS subscription with a curated catalog entry (#2). `NULL` for a user-added
 * subscription; the catalog entry's stable id for a source seeded from `curated-calendars/catalog.json`
 * — the key `CuratedCalendarSync` uses to reseed idempotently and the management screens use to tell
 * the two lists apart.
 */
export const ADD_ICS_CURATED_ID: Migration = {
  toVersion: 12,
  statements: [`ALTER TABLE ics_subscriptions ADD COLUMN curated_id TEXT;`],
};
