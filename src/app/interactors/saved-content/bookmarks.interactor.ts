import { inject, Injectable } from '@angular/core';

import { BookmarkDao } from '@app/data/daos/bookmark.dao';
import type { BookmarkRecord } from '@app/data/entities/bookmark.record';
import { BookmarkChanges } from '@app/cross-cutting/infrastructure/bookmark-changes';

/**
 * Bookmarking a content item for My Collection (#23 builds the collection screen on top of this;
 * this ticket only needs the toggle to persist).
 */
@Injectable({ providedIn: 'root' })
export class BookmarksInteractor {
  private readonly bookmarks = inject(BookmarkDao);
  private readonly changes = inject(BookmarkChanges);

  isBookmarked(contentItemId: string): Promise<boolean> {
    return this.bookmarks.isBookmarked(contentItemId);
  }

  list(): Promise<BookmarkRecord[]> {
    return this.bookmarks.list();
  }

  async toggle(contentItemId: string): Promise<void> {
    const bookmarked = await this.bookmarks.isBookmarked(contentItemId);

    if (bookmarked) {
      await this.bookmarks.remove(contentItemId);
    } else {
      await this.bookmarks.add(contentItemId, new Date().toISOString());
    }

    this.changes.notify();
  }
}
