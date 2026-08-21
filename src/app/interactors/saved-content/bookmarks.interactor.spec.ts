import { TestBed } from '@angular/core/testing';

import { BookmarkDao } from '@app/data/daos/bookmark.dao';
import type { BookmarkRecord } from '@app/data/entities/bookmark.record';
import { BookmarkChanges } from '@app/cross-cutting/infrastructure/bookmark-changes';

import { BookmarksInteractor } from './bookmarks.interactor';

class FakeBookmarkDao {
  bookmarked = new Map<string, string>();

  add(contentItemId: string, createdAt: string): Promise<void> {
    this.bookmarked.set(contentItemId, createdAt);
    return Promise.resolve();
  }

  remove(contentItemId: string): Promise<void> {
    this.bookmarked.delete(contentItemId);
    return Promise.resolve();
  }

  isBookmarked(contentItemId: string): Promise<boolean> {
    return Promise.resolve(this.bookmarked.has(contentItemId));
  }

  list(): Promise<BookmarkRecord[]> {
    return Promise.resolve(
      [...this.bookmarked.entries()].map(([contentItemId, createdAt]) => ({
        contentItemId,
        createdAt,
      })),
    );
  }
}

describe('BookmarksInteractor', () => {
  let dao: FakeBookmarkDao;
  let interactor: BookmarksInteractor;
  let changes: BookmarkChanges;

  beforeEach(() => {
    dao = new FakeBookmarkDao();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: BookmarkDao, useValue: dao }] });

    interactor = TestBed.inject(BookmarksInteractor);
    changes = TestBed.inject(BookmarkChanges);
  });

  it('reports an item as not bookmarked initially', async () => {
    await expect(interactor.isBookmarked('wi-01')).resolves.toBe(false);
  });

  it('toggle adds a bookmark that was not there and notifies BookmarkChanges', async () => {
    const before = changes.version();

    await interactor.toggle('wi-01');

    await expect(interactor.isBookmarked('wi-01')).resolves.toBe(true);
    expect(changes.version()).toBe(before + 1);
  });

  it('toggle removes a bookmark that was already there and notifies BookmarkChanges', async () => {
    await interactor.toggle('wi-01');
    const before = changes.version();

    await interactor.toggle('wi-01');

    await expect(interactor.isBookmarked('wi-01')).resolves.toBe(false);
    expect(changes.version()).toBe(before + 1);
  });

  it('lists the bookmarked content item ids', async () => {
    await interactor.toggle('wi-01');
    await interactor.toggle('reb-01');

    await expect(interactor.list()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ contentItemId: 'wi-01' }),
        expect.objectContaining({ contentItemId: 'reb-01' }),
      ]),
    );
  });
});
