import { inject, Injectable } from '@angular/core';

import { ContentCatalogSync } from '@app/data/content/content-catalog-sync';
import { BookmarkDao } from '@app/data/daos/bookmark.dao';
import { ContentSearchDao } from '@app/data/daos/content-search.dao';
import type { BookmarkRecord } from '@app/data/entities/bookmark.record';
import { toFtsMatch } from '@app/data/search/search-text';
import { BookmarkChanges } from '@app/cross-cutting/infrastructure/bookmark-changes';
import type { ContentItemView } from '@app/interactors/daily-content/content-item.vm';
import { ContentItemsInteractor } from '@app/interactors/daily-content/content-items.interactor';

/** Bookmarking a content item, and reading back the resulting My Collection (#23). */
@Injectable({ providedIn: 'root' })
export class BookmarksInteractor {
  private readonly bookmarks = inject(BookmarkDao);
  private readonly changes = inject(BookmarkChanges);
  private readonly contentItems = inject(ContentItemsInteractor);
  private readonly contentSearch = inject(ContentSearchDao);
  private readonly catalogSync = inject(ContentCatalogSync);

  isBookmarked(contentItemId: string): Promise<boolean> {
    return this.bookmarks.isBookmarked(contentItemId);
  }

  list(): Promise<BookmarkRecord[]> {
    return this.bookmarks.list();
  }

  /**
   * The full My Collection list: every bookmarked item still present in the catalog, newest
   * bookmark first (the order `BookmarkDao.list` already returns). A bookmark whose item was
   * removed from the catalog since is silently dropped rather than surfaced as a broken card.
   */
  async listSavedItems(): Promise<ContentItemView[]> {
    const bookmarks = await this.bookmarks.list();
    const items = await Promise.all(
      bookmarks.map((bookmark) => this.contentItems.findById(bookmark.contentItemId)),
    );
    return items.filter((item): item is ContentItemView => item !== null);
  }

  /**
   * The saved items matching what the user typed, best match first - or `null` when the query has
   * no term long enough to search for (see `toFtsMatch`), so the screen keeps showing the whole
   * collection. Like `listSavedItems`, an item gone from the catalog is dropped.
   */
  async searchSavedItems(query: string): Promise<ContentItemView[] | null> {
    const match = toFtsMatch(query);
    if (match === null) {
      return null;
    }

    await this.catalogSync.ensureSynced();
    const ids = await this.contentSearch.searchBookmarkedIds(match);
    const items = await Promise.all(ids.map((id) => this.contentItems.findById(id)));
    return items.filter((item): item is ContentItemView => item !== null);
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
