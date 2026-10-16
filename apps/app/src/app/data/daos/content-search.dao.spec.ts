import { TestBed } from '@angular/core/testing';

import { SQLITE_DATABASE } from '../gateways/sqlite-database';
import { InMemorySqliteDatabase } from '../gateways/sqlite-database.testing';
import { MIGRATIONS } from '../migrations/migrations';
import { foldForSearch, toFtsMatch } from '../search/search-text';
import { ContentSearchDao, type ContentSearchEntry } from './content-search.dao';

function entry(id: string, title: string, teaser = '', body = ''): ContentSearchEntry {
  return {
    contentItemId: id,
    title: foldForSearch(title),
    teaser: foldForSearch(teaser),
    body: foldForSearch(body),
  };
}

describe('ContentSearchDao', () => {
  let database: InMemorySqliteDatabase;
  let dao: ContentSearchDao;

  async function addItem(id: string, bookmarkedAt: string | null): Promise<void> {
    await database.run(
      `INSERT INTO content_items (id, kind, title, teaser, body_markdown, eligible_for_daily)
       VALUES (?, 'rebellin', ?, '', '', 0)`,
      [id, id],
    );
    if (bookmarkedAt !== null) {
      await database.run(`INSERT INTO bookmarks (content_item_id, created_at) VALUES (?, ?)`, [
        id,
        bookmarkedAt,
      ]);
    }
  }

  function search(query: string): Promise<string[]> {
    return dao.searchBookmarkedIds(toFtsMatch(query)!);
  }

  beforeEach(async () => {
    database = new InMemorySqliteDatabase();
    database.migrate(MIGRATIONS);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: SQLITE_DATABASE, useValue: database }],
    });
    dao = TestBed.inject(ContentSearchDao);

    await addItem('reb-01', '2026-10-01');
    await addItem('reb-02', '2026-10-02');
    await addItem('wi-01', '2026-10-03');
    await addItem('wi-02', null);
  });

  afterEach(() => {
    database.close();
  });

  it('finds a part of a word, so a compound is found by its last part', async () => {
    await dao.replaceAll([entry('wi-01', 'Mädchenberatungsstelle')]);

    await expect(search('beratung')).resolves.toEqual(['wi-01']);
  });

  it('finds a gendered word written without its gender character', async () => {
    await dao.replaceAll([entry('reb-01', 'Rebell*innen der Wissenschaft')]);

    await expect(search('rebellinnen')).resolves.toEqual(['reb-01']);
    await expect(search('Rebell*innen')).resolves.toEqual(['reb-01']);
  });

  it('requires every term, in any column', async () => {
    await dao.replaceAll([
      entry('reb-01', 'Ada Lovelace', 'Mathematikerin'),
      entry('reb-02', 'Hedy Lamarr', 'Erfinderin'),
    ]);

    await expect(search('lovelace mathematik')).resolves.toEqual(['reb-01']);
    await expect(search('lovelace erfinderin')).resolves.toEqual([]);
  });

  it('only finds what is bookmarked', async () => {
    await dao.replaceAll([entry('wi-01', 'Zyklus'), entry('wi-02', 'Zyklus')]);

    await expect(search('zyklus')).resolves.toEqual(['wi-01']);
  });

  it('ranks a match in the title before one in the text', async () => {
    await dao.replaceAll([
      entry('reb-01', 'Erfinderinnen', '', 'Sie forschte zur Menstruation.'),
      entry('reb-02', 'Menstruation', '', 'Ein Zyklus hat Phasen.'),
    ]);

    await expect(search('menstruation')).resolves.toEqual(['reb-02', 'reb-01']);
  });

  it('replaces the whole index', async () => {
    await dao.replaceAll([entry('reb-01', 'Zyklus')]);
    await dao.replaceAll([entry('reb-02', 'Zyklus')]);

    await expect(search('zyklus')).resolves.toEqual(['reb-02']);
    await expect(dao.count()).resolves.toBe(1);
  });

  it('writes more rows than fit in one statement', async () => {
    const many = Array.from({ length: 95 }, (_, index) => entry(`x-${index}`, 'Thema'));

    await dao.replaceAll(many);

    await expect(dao.count()).resolves.toBe(95);
  });
});
