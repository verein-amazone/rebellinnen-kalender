import type { Migration } from './migration';

/**
 * Carries a device event's description/notes through to the read-only detail view. Only device
 * rows ever populate it (see `device-normalizer.ts`): app-owned items keep their note on the
 * canonical `app_items` row, fetched separately (`AppEventEditingInteractor.findRecord`), and ICS
 * description support is out of scope here. `NULL` for every existing row until the next device
 * refresh repopulates it.
 */
export const ADD_OCCURRENCE_DESCRIPTION: Migration = {
  toVersion: 9,
  statements: [`ALTER TABLE occurrences ADD COLUMN description TEXT;`],
};
