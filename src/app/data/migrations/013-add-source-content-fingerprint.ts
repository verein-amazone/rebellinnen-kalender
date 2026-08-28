import type { Migration } from './migration';

/**
 * A digest of the external data the source's derived rows were built from, so a refresh can tell
 * that rebuilding them would produce exactly what is already there and skip the work.
 *
 * Only the device source uses it: app and ICS rows are materialized from canonical data that lives
 * in this same database, so there is nothing external to fingerprint and the column stays `NULL`
 * for them. `NULL` also means "unknown" - every existing install takes one full rebuild after the
 * upgrade and is accurate from then on, which is why there is no backfill.
 */
export const ADD_SOURCE_CONTENT_FINGERPRINT: Migration = {
  toVersion: 13,
  statements: [`ALTER TABLE source_coverage ADD COLUMN content_fingerprint TEXT;`],
};
