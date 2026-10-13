import type { Migration } from './migration';

/**
 * Full-text search over Meine Sammlung and the Anlaufstellen.
 *
 * Both indexes are FTS5 tables with the `trigram` tokenizer: every run of three characters is
 * indexed, so a query matches anywhere inside a word, not only at its start. German builds words by
 * compounding, and „beratung“ has to find „Mädchenberatungsstelle“ - a word-based index would only
 * find it from „mädchen“. The price is a three-character minimum per search term, which
 * `toFtsMatch` (`data/search/search-text.ts`) enforces.
 *
 * The indexed text is not the displayed text: `foldForSearch` lowercases it, strips diacritics and
 * gender characters (`Rebell*innen` → `rebellinnen`) and turns punctuation into spaces, and the
 * query is folded the same way. The rows are written by the catalog syncs, never by a trigger,
 * because the folding is TypeScript, not SQL.
 *
 * `support_services` makes the Anlaufstellen catalog a table like `content_items`, reconciled from
 * its JSON asset by `SupportServiceCatalogSync`, so that the search can join the index to the rows.
 * `actions` is the entry's contact list as JSON - it is only ever read whole.
 *
 * Every statement survives running twice (see `migrations.spec.ts`).
 */
export const CREATE_SEARCH_INDEX: Migration = {
  toVersion: 21,
  statements: [
    `CREATE VIRTUAL TABLE IF NOT EXISTS content_search USING fts5(
      content_item_id UNINDEXED,
      title,
      teaser,
      body,
      tokenize = 'trigram'
    );`,
    `CREATE TABLE IF NOT EXISTS support_services (
      id       TEXT PRIMARY KEY NOT NULL,
      region   TEXT NOT NULL,
      name     TEXT NOT NULL,
      teaser   TEXT NOT NULL,
      icon     TEXT NOT NULL,
      actions  TEXT NOT NULL,
      position INTEGER NOT NULL
    );`,
    `CREATE VIRTUAL TABLE IF NOT EXISTS support_service_search USING fts5(
      support_service_id UNINDEXED,
      name,
      teaser,
      region,
      contacts,
      tokenize = 'trigram'
    );`,
  ],
};
