import { TestBed } from '@angular/core/testing';

import { BookmarkDao } from '@app/data/daos/bookmark.dao';
import type { BookmarkRecord } from '@app/data/entities/bookmark.record';
import { BookmarkChanges } from '@app/cross-cutting/infrastructure/bookmark-changes';
import type { ContentItemView } from '@app/interactors/daily-content/content-item.vm';
import { ContentItemsInteractor } from '@app/interactors/daily-content/content-items.interactor';

import { BookmarksInteractor } from './bookmarks.interactor';

function item(overrides: Partial<ContentItemView> = {}): ContentItemView {
  return {
    id: 'wi-01',
    kind: 'wissensimpulse',
    title: 'Titel',
    teaser: 'Teaser',
    bodyMarkdown: 'Text',
    imagePath: null,
    imageAlt: null,
    imageAttribution: null,
    sourceLabel: null,
    sourceUrl: null,
    relatedSources: [],
    dailyRender: 'teaser',
    ...overrides,
  };
}

class FakeContentItemsInteractor {
  items = new Map<string, ContentItemView>();

  findById(id: string): Promise<ContentItemView | null> {
    return Promise.resolve(this.items.get(id) ?? null);
  }
}

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
  let contentItems: FakeContentItemsInteractor;
  let interactor: BookmarksInteractor;
  let changes: BookmarkChanges;

  beforeEach(() => {
    dao = new FakeBookmarkDao();
    contentItems = new FakeContentItemsInteractor();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: BookmarkDao, useValue: dao },
        { provide: ContentItemsInteractor, useValue: contentItems },
      ],
    });

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

  it('lists the saved items themselves, resolved through the content items interactor', async () => {
    contentItems.items.set('wi-01', item({ id: 'wi-01', title: 'Erster' }));
    contentItems.items.set('reb-01', item({ id: 'reb-01', kind: 'rebellin', title: 'Zweite' }));
    await interactor.toggle('wi-01');
    await interactor.toggle('reb-01');

    await expect(interactor.listSavedItems()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'wi-01', title: 'Erster' }),
        expect.objectContaining({ id: 'reb-01', title: 'Zweite' }),
      ]),
    );
  });

  it('drops a bookmark whose item no longer exists in the catalog', async () => {
    await interactor.toggle('gone');

    await expect(interactor.listSavedItems()).resolves.toEqual([]);
  });
});
