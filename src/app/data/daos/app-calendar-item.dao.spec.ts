import { TestBed } from '@angular/core/testing';

import type { AppItemExceptionRecord, AppItemRecord } from '../entities/app-item.record';
import { SQLITE_DATABASE } from '../gateways/sqlite-database';
import { InMemorySqliteDatabase } from '../gateways/sqlite-database.testing';
import { MIGRATIONS } from '../migrations/migrations';
import { AppCalendarItemDao } from './app-calendar-item.dao';

function item(overrides: Partial<AppItemRecord> = {}): AppItemRecord {
  return {
    id: 'item-1',
    calendarId: 'calendar-1',
    kind: 'event',
    title: 'Plenum',
    location: 'Vereinslokal',
    note: null,
    start: { kind: 'zoned', value: '2026-09-07T18:00:00', timeZone: 'Europe/Vienna' },
    end: { kind: 'zoned', value: '2026-09-07T20:00:00', timeZone: 'Europe/Vienna' },
    rrule: 'FREQ=WEEKLY;BYDAY=MO',
    predecessorSeriesId: null,
    ruleRevision: 0,
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    ...overrides,
  };
}

function exception(overrides: Partial<AppItemExceptionRecord> = {}): AppItemExceptionRecord {
  return {
    seriesId: 'item-1',
    originalStart: '2026-09-14T18:00:00',
    status: 'override',
    title: null,
    location: null,
    note: null,
    start: { kind: 'zoned', value: '2026-09-15T18:00:00', timeZone: 'Europe/Vienna' },
    end: null,
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('AppCalendarItemDao', () => {
  let database: InMemorySqliteDatabase;
  let dao: AppCalendarItemDao;

  beforeEach(async () => {
    database = new InMemorySqliteDatabase();
    database.migrate(MIGRATIONS);

    // The in-memory engine enforces the declared foreign keys, so the calendar the items point to
    // has to exist — closer to the truth than switching the checks off.
    await database.run(
      `INSERT INTO calendar_sources (id, type, name, enabled, state, created_at, updated_at)
       VALUES ('source-1', 'app', 'App', 1, 'ok', '2026-08-01T09:00:00.000Z', '2026-08-01T09:00:00.000Z')`,
    );
    await database.run(
      `INSERT INTO calendars (id, source_id, name, enabled, writable, created_at, updated_at)
       VALUES ('calendar-1', 'source-1', 'Termine', 1, 1, '2026-08-01T09:00:00.000Z', '2026-08-01T09:00:00.000Z')`,
    );

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: SQLITE_DATABASE, useValue: database }],
    });

    dao = TestBed.inject(AppCalendarItemDao);
  });

  afterEach(() => {
    database.close();
  });

  it('round-trips an item including the temporal triples', async () => {
    await dao.insert(item());

    await expect(dao.find('item-1')).resolves.toEqual(item());
  });

  it('round-trips a date-only item without end or zone', async () => {
    const allDay = item({
      id: 'item-2',
      start: { kind: 'date', value: '2026-09-07', timeZone: null },
      end: null,
      rrule: null,
    });
    await dao.insert(allDay);

    await expect(dao.find('item-2')).resolves.toEqual(allDay);
  });

  it('rewrites every mutable field on update', async () => {
    await dao.insert(item());

    const updated = item({
      title: 'Plenum (neu)',
      location: null,
      start: { kind: 'zoned', value: '2026-09-07T19:00:00', timeZone: 'Europe/Vienna' },
      rrule: 'FREQ=WEEKLY;BYDAY=TU',
      predecessorSeriesId: 'item-0',
      ruleRevision: 1,
      updatedAt: '2026-08-02T10:00:00.000Z',
    });
    await dao.update(updated);

    await expect(dao.find('item-1')).resolves.toEqual(updated);
  });

  it('upserts an exception so editing the same occurrence twice keeps one row', async () => {
    await dao.insert(item());
    await dao.upsertException(exception());
    await dao.upsertException(
      exception({ status: 'cancelled', start: null, updatedAt: '2026-08-02T10:00:00.000Z' }),
    );

    await expect(dao.listExceptionsOfSeries('item-1')).resolves.toEqual([
      exception({ status: 'cancelled', start: null, updatedAt: '2026-08-02T10:00:00.000Z' }),
    ]);
  });

  it('deletes only the exception tail from a split point on', async () => {
    await dao.insert(item());
    await dao.upsertException(exception({ originalStart: '2026-09-14T18:00:00' }));
    await dao.upsertException(exception({ originalStart: '2026-09-21T18:00:00' }));
    await dao.upsertException(exception({ originalStart: '2026-09-28T18:00:00' }));

    await dao.deleteExceptionsFrom('item-1', '2026-09-21T18:00:00');

    const remaining = await dao.listExceptionsOfSeries('item-1');
    expect(remaining.map((row) => row.originalStart)).toEqual(['2026-09-14T18:00:00']);
  });

  it('joins a transaction through the executor parameter and rolls back with it', async () => {
    await expect(
      database.transaction(async (tx) => {
        await dao.insert(item(), tx);
        await dao.upsertException(exception(), tx);
        throw new Error('unit of work failed');
      }),
    ).rejects.toThrow('unit of work failed');

    await expect(dao.find('item-1')).resolves.toBeNull();
    await expect(dao.listExceptionsOfSeries('item-1')).resolves.toEqual([]);
  });
});
