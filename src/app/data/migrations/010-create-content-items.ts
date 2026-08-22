import type { Migration } from './migration';

/**
 * Schema for the Today page's daily impulse (#1): "Wissen & Impulse" pieces and "Rebell*in"
 * portraits, plus the minimal bookmarks table the same ticket's bookmark toggle writes to (reused,
 * not rebuilt, by the My Collection ticket later).
 *
 * `content_items`: `valid_from`/`valid_to` are ISO dates parsed from the source docx's
 * `Ausspielungszeitraum` field. Both `NULL` means evergreen. `eligible_for_daily` mirrors the
 * source's own "daily-impulse eligible" flag.
 *
 * `bookmarks`: one row per bookmarked item, keyed by the item itself — a user either has bookmarked
 * an item or has not, so there is nothing else to store per bookmark beyond when it happened.
 *
 * Unlike every other table, `content_items` is never seeded here. The curated catalog is editorial
 * content that changes far more often than the schema does, so it ships as a versioned JSON asset
 * (`public/content/catalog.json`) that `ContentCatalogSync` reconciles into this table at runtime —
 * see that file for why a schema migration is the wrong tool for content that isn't shipped in the
 * app binary's code.
 */
export const CREATE_CONTENT_ITEMS: Migration = {
  toVersion: 10,
  statements: [
    `CREATE TABLE IF NOT EXISTS content_items (
      id                TEXT PRIMARY KEY NOT NULL,
      kind              TEXT NOT NULL CHECK (kind IN ('wissensimpulse', 'rebellin')),
      title             TEXT NOT NULL,
      teaser            TEXT NOT NULL,
      body_markdown     TEXT NOT NULL,
      image_path        TEXT,
      image_attribution TEXT,
      source_label      TEXT,
      source_url        TEXT,
      valid_from        TEXT,
      valid_to          TEXT,
      eligible_for_daily INTEGER NOT NULL DEFAULT 0
    );`,
    `CREATE TABLE IF NOT EXISTS bookmarks (
      content_item_id TEXT PRIMARY KEY NOT NULL REFERENCES content_items (id),
      created_at      TEXT NOT NULL
    );`,
  ],
};
