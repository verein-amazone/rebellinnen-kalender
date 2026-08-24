import type { Migration } from './migration';

/**
 * Adds the "More on this topic" related-sources list to `content_items` (#22). Stored as a JSON
 * array of `{ title, url }` objects — SQLite has no array column type, and a separate join table
 * would be overkill for a handful of editorially-curated links per item. `NULL` for every existing
 * row until the catalog starts populating it.
 */
export const ADD_RELATED_SOURCES: Migration = {
  toVersion: 11,
  statements: [`ALTER TABLE content_items ADD COLUMN related_sources TEXT;`],
};
