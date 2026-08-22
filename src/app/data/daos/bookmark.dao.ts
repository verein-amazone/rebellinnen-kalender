import { inject, Injectable } from '@angular/core';

import type { BookmarkRecord } from '../entities/bookmark.record';
import { SQLITE_DATABASE, type SqliteExecutor } from '../gateways/sqlite-database';

/** The database shape of a `bookmarks` row. */
interface BookmarkRow {
  readonly content_item_id: string;
  readonly created_at: string;
}

/** Table access for bookmarked content items. No business rules live here. */
@Injectable({ providedIn: 'root' })
export class BookmarkDao {
  private readonly database = inject(SQLITE_DATABASE);

  async add(
    contentItemId: string,
    createdAt: string,
    executor: SqliteExecutor = this.database,
  ): Promise<void> {
    await executor.run(
      `INSERT INTO bookmarks (content_item_id, created_at) VALUES (?, ?)
       ON CONFLICT (content_item_id) DO NOTHING`,
      [contentItemId, createdAt],
    );
  }

  async remove(contentItemId: string, executor: SqliteExecutor = this.database): Promise<void> {
    await executor.run(`DELETE FROM bookmarks WHERE content_item_id = ?`, [contentItemId]);
  }

  async list(executor: SqliteExecutor = this.database): Promise<BookmarkRecord[]> {
    const rows = await executor.query<BookmarkRow>(
      `SELECT content_item_id, created_at FROM bookmarks ORDER BY created_at DESC`,
    );

    return rows.map(toRecord);
  }

  async isBookmarked(
    contentItemId: string,
    executor: SqliteExecutor = this.database,
  ): Promise<boolean> {
    const rows = await executor.query<BookmarkRow>(
      `SELECT content_item_id, created_at FROM bookmarks WHERE content_item_id = ?`,
      [contentItemId],
    );

    return rows.length > 0;
  }
}

function toRecord(row: BookmarkRow): BookmarkRecord {
  return { contentItemId: row.content_item_id, createdAt: row.created_at };
}
