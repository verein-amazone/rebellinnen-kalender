import { TestBed } from '@angular/core/testing';

import type { ReminderRecord } from '../entities/reminder.record';
import { SQLITE_DATABASE } from '../gateways/sqlite-database';
import { InMemorySqliteDatabase } from '../gateways/sqlite-database.testing';
import { MIGRATIONS } from '../migrations/migrations';
import { ReminderDao } from './reminder.dao';

function record(overrides: Partial<ReminderRecord> = {}): ReminderRecord {
  return {
    id: 'id-1',
    text: 'Blumen gießen',
    completedAt: null,
    createdAt: '2026-08-05T10:00:00.000Z',
    updatedAt: '2026-08-05T10:00:00.000Z',
    ...overrides,
  };
}

describe('ReminderDao', () => {
  let database: InMemorySqliteDatabase;
  let dao: ReminderDao;

  beforeEach(() => {
    database = new InMemorySqliteDatabase();
    database.migrate(MIGRATIONS);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: SQLITE_DATABASE, useValue: database }],
    });

    dao = TestBed.inject(ReminderDao);
  });

  afterEach(() => {
    database.close();
  });

  it('stores an entry and reads it back unchanged', async () => {
    const entry = record();

    await dao.insert(entry);

    expect(await dao.listAll()).toEqual([entry]);
  });

  it('lists open entries before completed ones, each in creation order', async () => {
    await dao.insert(record({ id: 'a', createdAt: '2026-08-05T10:00:00.000Z' }));
    await dao.insert(
      record({
        id: 'b',
        createdAt: '2026-08-05T11:00:00.000Z',
        completedAt: '2026-08-05T12:00:00.000Z',
      }),
    );
    await dao.insert(record({ id: 'c', createdAt: '2026-08-05T12:00:00.000Z' }));
    await dao.insert(
      record({
        id: 'd',
        createdAt: '2026-08-05T09:00:00.000Z',
        completedAt: '2026-08-05T13:00:00.000Z',
      }),
    );

    expect((await dao.listAll()).map((entry) => entry.id)).toEqual(['a', 'c', 'd', 'b']);
  });

  it('updates the text and the update timestamp', async () => {
    await dao.insert(record());

    await dao.updateText('id-1', 'Blumen gießen und lüften', '2026-08-05T14:00:00.000Z');

    const [entry] = await dao.listAll();
    expect(entry.text).toBe('Blumen gießen und lüften');
    expect(entry.updatedAt).toBe('2026-08-05T14:00:00.000Z');
    expect(entry.createdAt).toBe('2026-08-05T10:00:00.000Z');
  });

  it('completes an entry and reopens it again', async () => {
    await dao.insert(record());

    await dao.updateCompletedAt('id-1', '2026-08-05T15:00:00.000Z', '2026-08-05T15:00:00.000Z');
    expect((await dao.listAll())[0].completedAt).toBe('2026-08-05T15:00:00.000Z');

    await dao.updateCompletedAt('id-1', null, '2026-08-05T16:00:00.000Z');
    // Exactly `null`, never `undefined`: the record type promises one of the two.
    expect((await dao.listAll())[0].completedAt).toBeNull();
  });

  it('deletes an entry', async () => {
    await dao.insert(record({ id: 'a' }));
    await dao.insert(record({ id: 'b' }));

    await dao.delete('a');

    expect((await dao.listAll()).map((entry) => entry.id)).toEqual(['b']);
  });

  it('stores SQL syntax in the text as data', async () => {
    const text = `Zettel'; DROP TABLE reminders; -- abholen`;

    await dao.insert(record({ text }));

    expect((await dao.listAll())[0].text).toBe(text);
  });
});
