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

  /** Two calendars in two sources, so ordering has something to order. */
  async function seedTwoCalendars(): Promise<void> {
    const at = '2026-08-01T09:00:00.000Z';
    await sources.insertSource({
      id: 'app-source',
      type: 'app',
      name: 'App',
      enabled: true,
      state: 'ok',
      createdAt: at,
      updatedAt: at,
    });
    await sources.insertSource({
      id: 'device-source',
      type: 'device',
      name: 'Gerätekalender',
      enabled: true,
      state: 'ok',
      createdAt: at,
      updatedAt: at,
    });
    await sources.insertCalendar({
      id: 'calendar-1',
      sourceId: 'app-source',
      name: 'Mein Kalender',
      color: null,
      emoji: null,
      enabled: true,
      writable: true,
      externalId: null,
      nativeSourceId: null,
      nativeSourceName: null,
      createdAt: at,
      updatedAt: at,
    });
    await sources.insertCalendar({
      id: 'device-cal:cal-1',
      sourceId: 'device-source',
      name: 'Arbeit',
      color: null,
      emoji: null,
      enabled: true,
      writable: true,
      externalId: 'cal-1',
      nativeSourceId: null,
      nativeSourceName: null,
      createdAt: at,
      updatedAt: at,
    });
  }

  beforeEach(() => {
    localStorage.clear();
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

  it('orders by source type, then by name, until the user arranges the chips', async () => {
    await seedTwoCalendars();

    const ids = (await interactor.listFilterable()).map((option) => option.id);

    expect(ids).toEqual(['calendar-1', 'device-cal:cal-1']);
  });

  it('follows the arranged order once the user has moved a chip', async () => {
    await seedTwoCalendars();

    await interactor.move('device-cal:cal-1', 0);

    const ids = (await interactor.listFilterable()).map((option) => option.id);
    expect(ids).toEqual(['device-cal:cal-1', 'calendar-1']);
  });

  it('puts a calendar the user never placed after the arranged ones', async () => {
    await seedTwoCalendars();
    await interactor.move('device-cal:cal-1', 0);

    const at = '2026-08-02T09:00:00.000Z';
    await sources.insertCalendar({
      id: 'calendar-2',
      sourceId: 'app-source',
      name: 'Aaa neuer Kalender',
      color: null,
      emoji: null,
      enabled: true,
      writable: true,
      externalId: null,
      nativeSourceId: null,
      nativeSourceName: null,
      createdAt: at,
      updatedAt: at,
    });

    const ids = (await interactor.listFilterable()).map((option) => option.id);
    // Alphabetically first among the app calendars, but it still follows what was arranged.
    expect(ids).toEqual(['device-cal:cal-1', 'calendar-1', 'calendar-2']);
  });

  it('ignores a stored id whose calendar is gone, and drops it on the next move', async () => {
    await seedTwoCalendars();
    localStorage.setItem(
      'rk.calendarChips',
      JSON.stringify({ hiddenCalendarIds: [], calendarOrder: ['weg', 'device-cal:cal-1'] }),
    );
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: SQLITE_DATABASE, useValue: database }],
    });
    const reloaded = TestBed.inject(CalendarFiltersInteractor);

    expect((await reloaded.listFilterable()).map((option) => option.id)).toEqual([
      'device-cal:cal-1',
      'calendar-1',
    ]);

    await reloaded.move('calendar-1', 0);

    expect(JSON.parse(localStorage.getItem('rk.calendarChips')!).calendarOrder).toEqual([
      'calendar-1',
      'device-cal:cal-1',
    ]);
  });

  it('toggles a calendar out of the chip row and back in, and remembers it', async () => {
    await seedTwoCalendars();

    interactor.toggleHidden('calendar-1');
    expect([...interactor.hiddenIds()]).toEqual(['calendar-1']);
    expect(JSON.parse(localStorage.getItem('rk.calendarChips')!).hiddenCalendarIds).toEqual([
      'calendar-1',
    ]);

    interactor.toggleHidden('calendar-1');
    expect([...interactor.hiddenIds()]).toEqual([]);
  });
});
