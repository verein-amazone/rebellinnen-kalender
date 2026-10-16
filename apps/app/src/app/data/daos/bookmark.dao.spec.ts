import { TestBed } from '@angular/core/testing';

import { SQLITE_DATABASE } from '../gateways/sqlite-database';
import { InMemorySqliteDatabase } from '../gateways/sqlite-database.testing';
import { MIGRATIONS } from '../migrations/migrations';
import { BookmarkDao } from './bookmark.dao';

describe('BookmarkDao', () => {
  let database: InMemorySqliteDatabase;
  let dao: BookmarkDao;

  beforeEach(async () => {
    database = new InMemorySqliteDatabase();
    database.migrate(MIGRATIONS);

    // `bookmarks.content_item_id` references `content_items(id)`, so a bookmark needs a matching
    // row to point at.
    await database.run(
      `INSERT INTO content_items (id, kind, title, teaser, body_markdown, eligible_for_daily)
       VALUES ('wi-01', 'wissensimpulse', 'W', 'w', 'w', 1),
              ('reb-01', 'rebellin', 'R', 'r', 'r', 1)`,
    );

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: SQLITE_DATABASE, useValue: database }],
    });

    dao = TestBed.inject(BookmarkDao);
  });

  afterEach(() => {
    database.close();
  });

  it('reports an item as not bookmarked before it is added', async () => {
    await expect(dao.isBookmarked('wi-01')).resolves.toBe(false);
  });

  it('adds a bookmark and reports it as bookmarked', async () => {
    await dao.add('wi-01', '2026-08-21T09:00:00.000Z');

    await expect(dao.isBookmarked('wi-01')).resolves.toBe(true);
  });

  it('lists bookmarks ordered by most recently created first', async () => {
    await dao.add('wi-01', '2026-08-21T09:00:00.000Z');
    await dao.add('reb-01', '2026-08-21T10:00:00.000Z');

    await expect(dao.list()).resolves.toEqual([
      { contentItemId: 'reb-01', createdAt: '2026-08-21T10:00:00.000Z' },
      { contentItemId: 'wi-01', createdAt: '2026-08-21T09:00:00.000Z' },
    ]);
  });

  it('does not duplicate a bookmark added twice', async () => {
    await dao.add('wi-01', '2026-08-21T09:00:00.000Z');
    await dao.add('wi-01', '2026-08-21T09:05:00.000Z');

    await expect(dao.list()).resolves.toHaveLength(1);
  });

  it('removes a bookmark', async () => {
    await dao.add('wi-01', '2026-08-21T09:00:00.000Z');

    await dao.remove('wi-01');

    await expect(dao.isBookmarked('wi-01')).resolves.toBe(false);
  });

  it('removing an id that was never bookmarked does nothing', async () => {
    await expect(dao.remove('does-not-exist')).resolves.toBeUndefined();
  });
});
