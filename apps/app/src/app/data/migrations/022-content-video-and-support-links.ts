import type { Migration } from './migration';

/**
 * Adds two catalog fields to `content_items`:
 *
 * - `video`: the item's embedded video as JSON (`{ provider, id, orientation }`), `NULL` without one.
 * - `support_service_ids`: the Anlaufstellen an item points to, as a JSON array. `NULL` points to
 *   none, `[]` to the Anlaufstellen page as a whole, and a list of ids to those entries.
 *
 * Both start empty: the table is a copy of `public/content/catalog.json`, and the catalog version
 * that ships with this migration makes `ContentCatalogSync` rewrite every row and fill them.
 *
 * Rebuilt rather than altered for the reason `020-rebuild-content-items.ts` gives: a second
 * `ALTER TABLE … ADD COLUMN` fails on the column the first one added, and a migration has to survive
 * running twice. The copy names only the columns both shapes share, so it works on either, and
 * `bookmarks` is put aside and restored around the swap because it references `content_items`.
 */
export const ADD_CONTENT_VIDEO_AND_SUPPORT_LINKS: Migration = {
  toVersion: 22,
  statements: [
    `CREATE TABLE IF NOT EXISTS content_items_next (
      id                  TEXT PRIMARY KEY NOT NULL,
      kind                TEXT NOT NULL CHECK (kind IN ('wissensimpulse', 'rebellin')),
      title               TEXT NOT NULL,
      teaser              TEXT NOT NULL,
      body_markdown       TEXT NOT NULL,
      hero_image_id       TEXT,
      source_label        TEXT,
      source_url          TEXT,
      valid_from          TEXT,
      valid_to            TEXT,
      eligible_for_daily  INTEGER NOT NULL DEFAULT 0,
      related_sources     TEXT,
      video               TEXT,
      support_service_ids TEXT
    );`,
    `INSERT OR REPLACE INTO content_items_next (id, kind, title, teaser, body_markdown,
      hero_image_id, source_label, source_url, valid_from, valid_to, eligible_for_daily,
      related_sources)
     SELECT id, kind, title, teaser, body_markdown, hero_image_id, source_label, source_url,
      valid_from, valid_to, eligible_for_daily, related_sources
     FROM content_items;`,
    `CREATE TABLE IF NOT EXISTS bookmarks_saved (
      content_item_id TEXT PRIMARY KEY NOT NULL,
      created_at      TEXT NOT NULL
    );`,
    `INSERT OR REPLACE INTO bookmarks_saved (content_item_id, created_at)
     SELECT content_item_id, created_at FROM bookmarks;`,
    `DROP TABLE IF EXISTS bookmarks;`,
    `DROP TABLE IF EXISTS content_items;`,
    `ALTER TABLE content_items_next RENAME TO content_items;`,
    `CREATE TABLE IF NOT EXISTS bookmarks (
      content_item_id TEXT PRIMARY KEY NOT NULL REFERENCES content_items (id),
      created_at      TEXT NOT NULL
    );`,
    `INSERT OR REPLACE INTO bookmarks (content_item_id, created_at)
     SELECT content_item_id, created_at FROM bookmarks_saved;`,
    `DROP TABLE IF EXISTS bookmarks_saved;`,
  ],
};
