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
    position: 1000,
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

  it('lists open entries before completed ones, each in the manual order', async () => {
    // The creation timestamps deliberately contradict the positions, so only the position can decide.
    await dao.insert(record({ id: 'a', position: 2000, createdAt: '2026-08-05T09:00:00.000Z' }));
    await dao.insert(
      record({
        id: 'b',
        position: 2000,
        createdAt: '2026-08-05T08:00:00.000Z',
        completedAt: '2026-08-05T12:00:00.000Z',
      }),
    );
    await dao.insert(record({ id: 'c', position: 1000, createdAt: '2026-08-05T12:00:00.000Z' }));
    await dao.insert(
      record({
        id: 'd',
        position: 1000,
        createdAt: '2026-08-05T11:00:00.000Z',
        completedAt: '2026-08-05T13:00:00.000Z',
      }),
    );

    expect((await dao.listAll()).map((entry) => entry.id)).toEqual(['c', 'a', 'd', 'b']);
  });

  it('breaks a tie between two identical positions by creation time', async () => {
    await dao.insert(
      record({ id: 'later', position: 1000, createdAt: '2026-08-05T12:00:00.000Z' }),
    );
    await dao.insert(
      record({ id: 'earlier', position: 1000, createdAt: '2026-08-05T09:00:00.000Z' }),
    );

    expect((await dao.listAll()).map((entry) => entry.id)).toEqual(['earlier', 'later']);
  });

  it('updates the text and the update timestamp', async () => {
    await dao.insert(record());

    await dao.updateText('id-1', 'Blumen gießen und lüften', '2026-08-05T14:00:00.000Z');

    const [entry] = await dao.listAll();
    expect(entry.text).toBe('Blumen gießen und lüften');
    expect(entry.updatedAt).toBe('2026-08-05T14:00:00.000Z');
    expect(entry.createdAt).toBe('2026-08-05T10:00:00.000Z');
  });

  it('completes an entry and reopens it again, each time with a new position', async () => {
    await dao.insert(record());

    await dao.updateCompletion('id-1', '2026-08-05T15:00:00.000Z', 500, '2026-08-05T15:00:00.000Z');
    const [completed] = await dao.listAll();
    expect(completed.completedAt).toBe('2026-08-05T15:00:00.000Z');
    expect(completed.position).toBe(500);

    await dao.updateCompletion('id-1', null, 3000, '2026-08-05T16:00:00.000Z');
    const [reopened] = await dao.listAll();
    // Exactly `null`, never `undefined`: the record type promises one of the two.
    expect(reopened.completedAt).toBeNull();
    expect(reopened.position).toBe(3000);
    expect(reopened.updatedAt).toBe('2026-08-05T16:00:00.000Z');
  });

  it('moves an entry by writing its position', async () => {
    await dao.insert(record({ id: 'a', position: 1000 }));
    await dao.insert(record({ id: 'b', position: 2000 }));

    await dao.updatePosition('b', 500, '2026-08-05T17:00:00.000Z');

    const entries = await dao.listAll();
    expect(entries.map((entry) => entry.id)).toEqual(['b', 'a']);
    expect(entries[0].updatedAt).toBe('2026-08-05T17:00:00.000Z');
  });

  it('keeps a fractional position a number', async () => {
    await dao.insert(record({ id: 'a', position: 1000 }));
    await dao.insert(record({ id: 'b', position: 2000 }));

    await dao.updatePosition('b', 1500.5, '2026-08-05T17:00:00.000Z');

    expect((await dao.listAll())[1].position).toBe(1500.5);
  });

  it('reassigns several positions at once and leaves the other entries alone', async () => {
    await dao.insert(record({ id: 'a', position: 1000 }));
    await dao.insert(record({ id: 'b', position: 2000 }));
    await dao.insert(record({ id: 'untouched', position: 3000 }));

    await dao.reassignPositions(
      [
        { id: 'b', position: 1000 },
        { id: 'a', position: 2000 },
      ],
      '2026-08-05T18:00:00.000Z',
    );

    const entries = await dao.listAll();
    expect(entries.map((entry) => entry.id)).toEqual(['b', 'a', 'untouched']);
    expect(entries.find((entry) => entry.id === 'untouched')?.updatedAt).toBe(
      '2026-08-05T10:00:00.000Z',
    );
  });

  it('writes nothing when there is nothing to reassign', async () => {
    await dao.insert(record({ id: 'a', position: 1000 }));

    await dao.reassignPositions([], '2026-08-05T18:00:00.000Z');

    expect((await dao.listAll())[0]).toEqual(record({ id: 'a', position: 1000 }));
  });

  it('reports the position bounds of each section', async () => {
    await dao.insert(record({ id: 'a', position: 1000 }));
    await dao.insert(record({ id: 'b', position: 4000 }));
    await dao.insert(record({ id: 'c', position: 250, completedAt: '2026-08-05T12:00:00.000Z' }));

    expect(await dao.selectPositionRange(false)).toEqual({ min: 1000, max: 4000 });
    expect(await dao.selectPositionRange(true)).toEqual({ min: 250, max: 250 });
  });

  it('reports empty bounds for an empty section', async () => {
    await dao.insert(record({ id: 'a', position: 1000 }));

    expect(await dao.selectPositionRange(true)).toEqual({ min: null, max: null });
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
