import type { Migration } from './migration';

/**
 * Adds the two editorial fields the Tagesimpuls card needs.
 *
 * `image_alt` is a description of what the picture shows, in German, for people who cannot see it.
 * It exists because `image_attribution` was standing in as the image's `alt` text, which credits
 * the photographer instead of describing the photo - a caption, not a description.
 *
 * `daily_render` decides how the item renders *when it is today's impulse*: `image` leads with the
 * picture, `teaser` leads with the teaser line. `NULL` on every existing row until the catalog
 * populates it, and read as `teaser` - the layout the card had before this column existed.
 */
export const ADD_CONTENT_ITEM_IMAGE_ALT: Migration = {
  toVersion: 15,
  statements: [
    `ALTER TABLE content_items ADD COLUMN image_alt TEXT;`,
    `ALTER TABLE content_items ADD COLUMN daily_render TEXT;`,
  ],
};
