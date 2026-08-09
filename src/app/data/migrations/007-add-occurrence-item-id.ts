import type { Migration } from './migration';

/**
 * Gives every derived row the identity of the app-owned item it came from (#19), so the editing
 * flow can jump from an occurrence straight to its canonical `AppItemRecord` without re-deriving
 * the id from the occurrence key. `NULL` for device-cached and ICS rows, which have no app item.
 *
 * Existing rows are left `NULL` on upgrade rather than backfilled: derived rows are rebuilt from
 * canonical data on the next materialization anyway (see `CalendarRepository.rebuildAllDerived`),
 * so a stale row missing this column simply loses editability until then instead of risking a wrong
 * guess at its owning item.
 */
export const ADD_OCCURRENCE_ITEM_ID: Migration = {
  toVersion: 7,
  statements: [`ALTER TABLE occurrences ADD COLUMN item_id TEXT;`],
};
