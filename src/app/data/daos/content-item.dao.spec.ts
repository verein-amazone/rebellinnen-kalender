import { TestBed } from '@angular/core/testing';

import type { ContentItemRecord } from '../entities/content-item.record';
import { SQLITE_DATABASE } from '../gateways/sqlite-database';
import { InMemorySqliteDatabase } from '../gateways/sqlite-database.testing';
import { MIGRATIONS } from '../migrations/migrations';
import { ContentItemDao } from './content-item.dao';

function record(overrides: Partial<ContentItemRecord> = {}): ContentItemRecord {
  return {
    id: 'item-1',
    kind: 'wissensimpulse',
    title: 'Was tut dir gut?',
    teaser: 'Wir haben ein paar Ideen für dich!',
    bodyMarkdown: '- Ein Bad nehmen\n- Spazieren gehen',
    imagePath: null,
    imageAttribution: 'Verein Amazone',
    sourceLabel: null,
    sourceUrl: null,
    validFrom: null,
    validTo: null,
    eligibleForDaily: true,
    ...overrides,
  };
}

describe('ContentItemDao', () => {
  let database: InMemorySqliteDatabase;
  let dao: ContentItemDao;

  beforeEach(() => {
    database = new InMemorySqliteDatabase();
    database.migrate(MIGRATIONS);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: SQLITE_DATABASE, useValue: database }],
    });

    dao = TestBed.inject(ContentItemDao);
  });

  afterEach(() => {
    database.close();
  });

  it('finds an item by id', async () => {
    await database.run(
      `INSERT INTO content_items (id, kind, title, teaser, body_markdown, eligible_for_daily)
       VALUES ('wi-01', 'wissensimpulse', 'Menstruation, Hormone & Zyklus', 't', 'b', 1)`,
    );

    await expect(dao.findById('wi-01')).resolves.toMatchObject({
      id: 'wi-01',
      kind: 'wissensimpulse',
      title: 'Menstruation, Hormone & Zyklus',
    });
  });

  it('returns null for an unknown id', async () => {
    await expect(dao.findById('does-not-exist')).resolves.toBeNull();
  });

  it('round-trips an inserted item exactly', async () => {
    await database.run(`DELETE FROM content_items`);
    await database.run(
      `INSERT INTO content_items (id, kind, title, teaser, body_markdown, image_path,
        image_attribution, source_label, source_url, valid_from, valid_to, eligible_for_daily)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'item-1',
        'wissensimpulse',
        'Was tut dir gut?',
        'Wir haben ein paar Ideen für dich!',
        '- Ein Bad nehmen\n- Spazieren gehen',
        null,
        'Verein Amazone',
        null,
        null,
        null,
        null,
        1,
      ],
    );

    await expect(dao.findById('item-1')).resolves.toEqual(record());
  });

  it('lists only items eligible for a given day: evergreen and in-range date-specific items', async () => {
    await database.run(`DELETE FROM content_items`);
    await database.run(
      `INSERT INTO content_items (id, kind, title, teaser, body_markdown, eligible_for_daily)
       VALUES ('evergreen', 'wissensimpulse', 'E', 'e', 'e', 1)`,
    );
    await database.run(
      `INSERT INTO content_items (id, kind, title, teaser, body_markdown, valid_from, valid_to, eligible_for_daily)
       VALUES ('in-range', 'wissensimpulse', 'I', 'i', 'i', '2027-02-01', '2027-02-10', 1)`,
    );
    await database.run(
      `INSERT INTO content_items (id, kind, title, teaser, body_markdown, valid_from, valid_to, eligible_for_daily)
       VALUES ('out-of-range', 'wissensimpulse', 'O', 'o', 'o', '2027-03-01', '2027-03-10', 1)`,
    );
    await database.run(
      `INSERT INTO content_items (id, kind, title, teaser, body_markdown, valid_from, eligible_for_daily)
       VALUES ('open-ended-from', 'wissensimpulse', 'F', 'f', 'f', '2027-02-01', 1)`,
    );

    const ids = (await dao.listEligibleForDay('2027-02-05')).map((item) => item.id);

    expect(ids.sort()).toEqual(['evergreen', 'in-range', 'open-ended-from']);
  });

  it('lists the ids of every stored item', async () => {
    await database.run(`DELETE FROM content_items`);
    await dao.upsert(record({ id: 'a' }));
    await dao.upsert(record({ id: 'b' }));

    expect((await dao.listIds()).sort()).toEqual(['a', 'b']);
  });

  it('upsert inserts an item that does not exist yet', async () => {
    await database.run(`DELETE FROM content_items`);

    await dao.upsert(record({ id: 'new-item', title: 'Neu' }));

    await expect(dao.findById('new-item')).resolves.toMatchObject({ title: 'Neu' });
  });

  it('upsert overwrites an item that already exists, keeping its id', async () => {
    await database.run(`DELETE FROM content_items`);
    await dao.upsert(record({ id: 'existing', title: 'Alt' }));

    await dao.upsert(record({ id: 'existing', title: 'Neu' }));

    await expect(dao.findById('existing')).resolves.toMatchObject({
      id: 'existing',
      title: 'Neu',
    });
    expect((await dao.listIds()).filter((id) => id === 'existing')).toHaveLength(1);
  });

  it('lists every item ordered by kind then id', async () => {
    await database.run(`DELETE FROM content_items`);
    await dao.upsert(record({ id: 'wi-02', kind: 'wissensimpulse' }));
    await dao.upsert(record({ id: 'reb-01', kind: 'rebellin' }));
    await dao.upsert(record({ id: 'wi-01', kind: 'wissensimpulse' }));

    const ids = (await dao.listAll()).map((item) => item.id);

    expect(ids).toEqual(['reb-01', 'wi-01', 'wi-02']);
  });

  it('deletes an item by id', async () => {
    await database.run(`DELETE FROM content_items`);
    await dao.upsert(record({ id: 'to-remove' }));

    await dao.delete('to-remove');

    await expect(dao.findById('to-remove')).resolves.toBeNull();
  });
});
