import { TestBed } from '@angular/core/testing';

import type { CalendarRecord, CalendarSourceRecord } from '../entities/calendar-source.record';
import { SQLITE_DATABASE } from '../gateways/sqlite-database';
import { InMemorySqliteDatabase } from '../gateways/sqlite-database.testing';
import { MIGRATIONS } from '../migrations/migrations';
import { CalendarSourceDao } from './calendar-source.dao';

function source(overrides: Partial<CalendarSourceRecord> = {}): CalendarSourceRecord {
  return {
    id: 'source-1',
    type: 'app',
    name: 'Mein Kalender',
    enabled: true,
    state: 'ok',
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    ...overrides,
  };
}

function calendar(overrides: Partial<CalendarRecord> = {}): CalendarRecord {
  return {
    id: 'calendar-1',
    sourceId: 'source-1',
    name: 'Termine',
    color: '#aa3377',
    emoji: '🌸',
    enabled: true,
    writable: true,
    externalId: null,
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('CalendarSourceDao', () => {
  let database: InMemorySqliteDatabase;
  let dao: CalendarSourceDao;

  beforeEach(() => {
    database = new InMemorySqliteDatabase();
    database.migrate(MIGRATIONS);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: SQLITE_DATABASE, useValue: database }],
    });

    dao = TestBed.inject(CalendarSourceDao);
  });

  afterEach(() => {
    database.close();
  });

  it('round-trips a source including its enabled flag and state', async () => {
    await dao.insertSource(source({ enabled: false, state: 'stale' }));

    await expect(dao.listSources()).resolves.toEqual([source({ enabled: false, state: 'stale' })]);
  });

  it('finds one source by id and reports a missing one as null', async () => {
    await dao.insertSource(source());

    await expect(dao.findSource('source-1')).resolves.toEqual(source());
    await expect(dao.findSource('missing')).resolves.toBeNull();
  });

  it('updates state, enabled and name independently', async () => {
    await dao.insertSource(source());

    await dao.updateSourceState('source-1', 'permission-lost', '2026-08-02T10:00:00.000Z');
    await dao.updateSourceEnabled('source-1', false, '2026-08-03T10:00:00.000Z');
    await dao.updateSourceName('source-1', 'Gerätekalender', '2026-08-04T10:00:00.000Z');

    await expect(dao.findSource('source-1')).resolves.toEqual(
      source({
        state: 'permission-lost',
        enabled: false,
        name: 'Gerätekalender',
        updatedAt: '2026-08-04T10:00:00.000Z',
      }),
    );
  });

  it('round-trips a calendar including nullable colour, emoji and external id', async () => {
    await dao.insertSource(source());
    await dao.insertCalendar(calendar({ color: null, emoji: null, externalId: 'native-7' }));

    await expect(dao.listCalendarsOfSource('source-1')).resolves.toEqual([
      calendar({ color: null, emoji: null, externalId: 'native-7' }),
    ]);
  });

  it('scopes calendar reads and deletes to their source', async () => {
    await dao.insertSource(source({ id: 'source-1' }));
    await dao.insertSource(source({ id: 'source-2', type: 'device' }));
    await dao.insertCalendar(calendar({ id: 'calendar-1', sourceId: 'source-1' }));
    await dao.insertCalendar(calendar({ id: 'calendar-2', sourceId: 'source-2' }));

    await dao.deleteCalendarsOfSource('source-1');

    await expect(dao.listCalendarsOfSource('source-1')).resolves.toEqual([]);
    await expect(dao.listCalendarsOfSource('source-2')).resolves.toEqual([
      calendar({ id: 'calendar-2', sourceId: 'source-2' }),
    ]);
  });

  it('updates the device snapshot fields without touching the user identity fields', async () => {
    await dao.insertSource(source({ type: 'device' }));
    await dao.insertCalendar(calendar({ emoji: '🌙', color: '#123456' }));

    await dao.updateCalendarSnapshot('calendar-1', 'Familie', false, '2026-08-02T10:00:00.000Z');

    const [updated] = await dao.listCalendarsOfSource('source-1');
    expect(updated).toEqual(
      calendar({
        name: 'Familie',
        writable: false,
        emoji: '🌙',
        color: '#123456',
        updatedAt: '2026-08-02T10:00:00.000Z',
      }),
    );
  });

  it('joins a transaction through the executor parameter and rolls back with it', async () => {
    await dao.insertSource(source());

    await expect(
      database.transaction(async (tx) => {
        await dao.insertCalendar(calendar(), tx);
        throw new Error('unit of work failed');
      }),
    ).rejects.toThrow('unit of work failed');

    await expect(dao.listCalendars()).resolves.toEqual([]);
  });
});
