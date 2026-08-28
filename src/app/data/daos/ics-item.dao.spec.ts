import { TestBed } from '@angular/core/testing';

import type { IcsItemExceptionRecord, IcsItemRecord } from '../entities/ics.record';
import { SQLITE_DATABASE } from '../gateways/sqlite-database';
import { InMemorySqliteDatabase } from '../gateways/sqlite-database.testing';
import { MIGRATIONS } from '../migrations/migrations';
import { IcsItemDao } from './ics-item.dao';

function item(overrides: Partial<IcsItemRecord> = {}): IcsItemRecord {
  return {
    subscriptionId: 'sub-1',
    uid: 'uid-1',
    revisionId: 'rev-1',
    kind: 'event',
    title: 'Plenum',
    location: null,
    note: null,
    start: { kind: 'zoned', value: '2026-09-07T18:00:00', timeZone: 'Europe/Vienna' },
    end: null,
    rrule: null,
    ...overrides,
  };
}

function exception(overrides: Partial<IcsItemExceptionRecord> = {}): IcsItemExceptionRecord {
  return {
    subscriptionId: 'sub-1',
    uid: 'uid-1',
    originalStart: '2026-09-14T18:00:00',
    revisionId: 'rev-1',
    status: 'cancelled',
    title: null,
    location: null,
    note: null,
    start: null,
    end: null,
    ...overrides,
  };
}

describe('IcsItemDao', () => {
  let database: InMemorySqliteDatabase;
  let dao: IcsItemDao;

  beforeEach(() => {
    database = new InMemorySqliteDatabase();
    database.migrate(MIGRATIONS);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: SQLITE_DATABASE, useValue: database }],
    });

    dao = TestBed.inject(IcsItemDao);
  });

  afterEach(() => {
    database.close();
  });

  it('round-trips items and exceptions', async () => {
    await dao.insertItems([item()]);
    await dao.insertExceptions([exception()]);

    await expect(dao.listItems('sub-1')).resolves.toEqual([item()]);
    await expect(dao.listExceptions('sub-1')).resolves.toEqual([exception()]);
  });

  it('inserts a feed larger than one chunked statement', async () => {
    // Crosses the chunk boundary twice and ends mid-chunk, so a short final chunk runs too.
    const items = Array.from({ length: 121 }, (_, index) => item({ uid: `uid-${index}` }));

    await dao.insertItems(items);

    await expect(dao.listItems('sub-1')).resolves.toHaveLength(121);
  });

  it('lets the last entry win when one feed repeats a uid', async () => {
    // A duplicate inside a single multi-row statement must resolve exactly as it did when every
    // row was its own `INSERT OR REPLACE`.
    await dao.insertItems([item({ title: 'Erste' }), item({ title: 'Zweite' })]);

    await expect(dao.listItems('sub-1')).resolves.toEqual([item({ title: 'Zweite' })]);
  });

  it('reads every exception of a subscription, ordered by uid then original start', async () => {
    await dao.insertExceptions([
      exception({ uid: 'uid-2', originalStart: '2026-09-21T18:00:00' }),
      exception({ uid: 'uid-1', originalStart: '2026-09-28T18:00:00' }),
      exception({ uid: 'uid-1', originalStart: '2026-09-14T18:00:00' }),
      exception({ subscriptionId: 'sub-2', uid: 'uid-9' }),
    ]);

    const all = await dao.listExceptions('sub-1');

    expect(all.map((entry) => [entry.uid, entry.originalStart])).toEqual([
      ['uid-1', '2026-09-14T18:00:00'],
      ['uid-1', '2026-09-28T18:00:00'],
      ['uid-2', '2026-09-21T18:00:00'],
    ]);
  });

  it('writes nothing for an empty feed', async () => {
    await dao.insertItems([]);
    await dao.insertExceptions([]);

    await expect(dao.listItems('sub-1')).resolves.toEqual([]);
    await expect(dao.listExceptions('sub-1')).resolves.toEqual([]);
  });
});
