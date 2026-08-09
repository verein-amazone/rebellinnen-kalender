import { TestBed } from '@angular/core/testing';

import { CalendarSourceDao } from '@app/data/daos/calendar-source.dao';
import { SQLITE_DATABASE } from '@app/data/gateways/sqlite-database';
import { InMemorySqliteDatabase } from '@app/data/gateways/sqlite-database.testing';
import { MIGRATIONS } from '@app/data/migrations/migrations';
import { AppCalendarsInteractor } from './app-calendars.interactor';

describe('AppCalendarsInteractor', () => {
  let database: InMemorySqliteDatabase;
  let interactor: AppCalendarsInteractor;
  let sources: CalendarSourceDao;

  beforeEach(() => {
    database = new InMemorySqliteDatabase();
    database.migrate(MIGRATIONS);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: SQLITE_DATABASE, useValue: database }],
    });

    interactor = TestBed.inject(AppCalendarsInteractor);
    sources = TestBed.inject(CalendarSourceDao);
  });

  afterEach(() => {
    database.close();
  });

  it('lists only calendars of app sources, never device or ICS calendars', async () => {
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
      name: 'Termine',
      color: '#aa3377',
      emoji: '🌸',
      enabled: true,
      writable: true,
      externalId: null,
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });

    await sources.insertSource({
      id: 'device-source',
      type: 'device',
      name: 'Gerätekalender',
      enabled: true,
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
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });

    await expect(interactor.listWritable()).resolves.toEqual([
      { id: 'calendar-1', name: 'Termine', color: '#aa3377', emoji: '🌸' },
    ]);
  });

  it('creates the app calendar on first run instead of returning an empty picker', async () => {
    const result = await interactor.listWritable();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ name: 'Mein Kalender', color: null, emoji: null });

    const allSources = await sources.listSources();
    expect(allSources.filter((source) => source.type === 'app')).toHaveLength(1);
  });

  it('does not create a second app calendar on a later call', async () => {
    await interactor.listWritable();
    await interactor.listWritable();

    const allSources = await sources.listSources();
    expect(allSources.filter((source) => source.type === 'app')).toHaveLength(1);
  });
});
