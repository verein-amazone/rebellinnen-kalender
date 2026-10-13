import { inject, Injectable } from '@angular/core';

import { SQLITE_DATABASE, type SqliteExecutor } from '../gateways/sqlite-database';

/** One content item as the index holds it: its text already folded by `foldForSearch`. */
export interface ContentSearchEntry {
  readonly contentItemId: string;
  readonly title: string;
  readonly teaser: string;
  readonly body: string;
}

/** Rows per `INSERT` - see `INSERT_CHUNK_ROWS` in `occurrence.dao.ts`; four values per row. */
const INSERT_CHUNK_ROWS = 40;

/**
 * Column weights for `bm25()`, in the table's column order: a hit in the title counts most, one in
 * the body least, so an item named after the search term comes before one that mentions it. The
 * id column is not indexed and weighs nothing.
 */
const RANK = 'bm25(content_search, 0.0, 10.0, 4.0, 1.0)';

/**
 * Table access for `content_search`, the full-text index over the curated content (see
 * `021-search-index.ts`). It is written whole by `ContentCatalogSync` whenever the catalog is
 * reconciled, and only ever read through a `MATCH` built by `toFtsMatch`.
 */
@Injectable({ providedIn: 'root' })
export class ContentSearchDao {
  private readonly database = inject(SQLITE_DATABASE);

  /** Replaces the whole index - the catalog is small, and a full rebuild cannot drift. */
  async replaceAll(
    entries: readonly ContentSearchEntry[],
    executor: SqliteExecutor = this.database,
  ): Promise<void> {
    await executor.run(`DELETE FROM content_search`);

    for (let offset = 0; offset < entries.length; offset += INSERT_CHUNK_ROWS) {
      const chunk = entries.slice(offset, offset + INSERT_CHUNK_ROWS);

      await executor.run(
        `INSERT INTO content_search (content_item_id, title, teaser, body)
         VALUES ${new Array<string>(chunk.length).fill('(?, ?, ?, ?)').join(', ')}`,
        chunk.flatMap((entry) => [entry.contentItemId, entry.title, entry.teaser, entry.body]),
      );
    }
  }

  async count(executor: SqliteExecutor = this.database): Promise<number> {
    const rows = await executor.query<{ readonly count: number }>(
      `SELECT COUNT(*) AS count FROM content_search`,
    );
    return rows[0]?.count ?? 0;
  }

  /**
   * The bookmarked items matching `match` (a `toFtsMatch` expression), best match first. Equally
   * good matches keep the collection's own order: newest bookmark first.
   */
  async searchBookmarkedIds(
    match: string,
    executor: SqliteExecutor = this.database,
  ): Promise<string[]> {
    const rows = await executor.query<{ readonly id: string }>(
      `SELECT content_search.content_item_id AS id
       FROM content_search
       JOIN bookmarks ON bookmarks.content_item_id = content_search.content_item_id
       WHERE content_search MATCH ?
       ORDER BY ${RANK}, bookmarks.created_at DESC`,
      [match],
    );
    return rows.map((row) => row.id);
  }
}
