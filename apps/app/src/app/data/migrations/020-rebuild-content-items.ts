import type { Migration } from './migration';

/**
 * Reshapes `content_items` for the image catalog (`public/content/images.json`):
 *
 * - `image_path` becomes `hero_image_id`. An item names its picture by the image's id, and the
 *   catalog knows the file.
 * - `image_alt`, `image_attribution` and `daily_render` go. What a picture shows and whom it credits
 *   live in the image catalog, and the daily impulse always leads with its picture.
 *
 * The table is a copy of `public/content/catalog.json`, so the new column starts empty: the catalog
 * version that ships with this migration makes `ContentCatalogSync` rewrite every row and fill it.
 * Copying `NULL` rather than the old path also keeps the copy free of any column that exists in
 * only one of the two shapes.
 *
 * **Why a rebuild and not `ALTER TABLE`.** A migration has to survive running twice (see
 * `migrations.spec.ts`), and a second `DROP COLUMN` or `RENAME COLUMN` fails on the column the first
 * one already changed. So the table is rebuilt in its new shape instead: create, copy, drop, rename.
 * Every step also works on a table that already has that shape.
 *
 * **Why `bookmarks` is rebuilt as well.** It references `content_items`, and with
 * `PRAGMA foreign_keys` on, dropping `content_items` under a bookmark fails. The bookmarks are put
 * aside in a table without the reference, and restored once the new `content_items` is in place.
 * The content rows are copied too, although the catalog sync could rebuild them, because a bookmark
 * can only be restored onto the item it points at.
 */
export const REBUILD_CONTENT_ITEMS: Migration = {
  toVersion: 20,
  statements: [
    `CREATE TABLE IF NOT EXISTS content_items_next (
      id                 TEXT PRIMARY KEY NOT NULL,
      kind               TEXT NOT NULL CHECK (kind IN ('wissensimpulse', 'rebellin')),
      title              TEXT NOT NULL,
      teaser             TEXT NOT NULL,
      body_markdown      TEXT NOT NULL,
      hero_image_id      TEXT,
      source_label       TEXT,
      source_url         TEXT,
      valid_from         TEXT,
      valid_to           TEXT,
      eligible_for_daily INTEGER NOT NULL DEFAULT 0,
      related_sources    TEXT
    );`,
    `INSERT OR REPLACE INTO content_items_next (id, kind, title, teaser, body_markdown,
      hero_image_id, source_label, source_url, valid_from, valid_to, eligible_for_daily,
      related_sources)
     SELECT id, kind, title, teaser, body_markdown, NULL, source_label, source_url, valid_from,
      valid_to, eligible_for_daily, related_sources
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
