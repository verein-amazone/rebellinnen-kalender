import { TestBed } from '@angular/core/testing';

import { CalendarSourceDao } from '@app/data/daos/calendar-source.dao';
import { SQLITE_DATABASE } from '@app/data/gateways/sqlite-database';
import { InMemorySqliteDatabase } from '@app/data/gateways/sqlite-database.testing';
import { MIGRATIONS } from '@app/data/migrations/migrations';
import { CalendarFiltersInteractor } from './calendar-filters.interactor';

describe('CalendarFiltersInteractor', () => {
  let database: InMemorySqliteDatabase;
  let interactor: CalendarFiltersInteractor;
  let sources: CalendarSourceDao;

  beforeEach(() => {
    database = new InMemorySqliteDatabase();
    database.migrate(MIGRATIONS);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: SQLITE_DATABASE, useValue: database }],
    });

    interactor = TestBed.inject(CalendarFiltersInteractor);
    sources = TestBed.inject(CalendarSourceDao);
  });

  afterEach(() => {
    database.close();
  });

  it('lists enabled calendars of enabled sources with their identity', async () => {
    await sources.insertSource({
      id: 'app-source',
      type: 'app',
      name: 'App',
      enabled: true,
      state: 'ok',
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });
    await sources.insertCalendar({
      id: 'calendar-1',
      sourceId: 'app-source',
      name: 'Mein Kalender',
      color: '#7B3FA8',
      emoji: '📅',
      enabled: true,
      writable: true,
      externalId: null,
      nativeSourceId: null,
      nativeSourceName: null,
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });

    await expect(interactor.listFilterable()).resolves.toEqual([
      { id: 'calendar-1', name: 'Mein Kalender', color: '#7B3FA8', emoji: '📅' },
    ]);
  });

  it('excludes a disabled calendar', async () => {
    await sources.insertSource({
      id: 'app-source',
      type: 'app',
      name: 'App',
      enabled: true,
      state: 'ok',
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });
    await sources.insertCalendar({
      id: 'calendar-1',
      sourceId: 'app-source',
      name: 'Mein Kalender',
      color: null,
      emoji: null,
      enabled: false,
      writable: true,
      externalId: null,
      nativeSourceId: null,
      nativeSourceName: null,
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });

    await expect(interactor.listFilterable()).resolves.toEqual([]);
  });

  it('excludes calendars of a disabled source even if the calendar itself is enabled', async () => {
    await sources.insertSource({
      id: 'device-source',
      type: 'device',
      name: 'Gerätekalender',
      enabled: false,
      state: 'ok',
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });
    await sources.insertCalendar({
      id: 'device-cal:cal-1',
      sourceId: 'device-source',
      name: 'Familie',
      color: null,
      emoji: null,
      enabled: true,
      writable: true,
      externalId: 'cal-1',
      nativeSourceId: null,
      nativeSourceName: null,
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });

    await expect(interactor.listFilterable()).resolves.toEqual([]);
  });

  it('is empty when no calendars exist yet', async () => {
    await expect(interactor.listFilterable()).resolves.toEqual([]);
  });
});
