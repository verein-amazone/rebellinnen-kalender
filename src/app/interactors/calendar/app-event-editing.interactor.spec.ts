import { TestBed } from '@angular/core/testing';

import { AppCalendarItemDao } from '@app/data/daos/app-calendar-item.dao';
import { CalendarSourceDao } from '@app/data/daos/calendar-source.dao';
import { CAPACITOR_CALENDAR } from '@app/cross-cutting/plugins/calendar.plugin';
import { SQLITE_DATABASE } from '@app/data/gateways/sqlite-database';
import { InMemorySqliteDatabase } from '@app/data/gateways/sqlite-database.testing';
import { MIGRATIONS } from '@app/data/migrations/migrations';
import {
  AppEventEditingInteractor,
  AppEventTitleInvalidError,
  type AppEventDraft,
} from './app-event-editing.interactor';

import { Temporal } from 'temporal-polyfill';

function draft(overrides: Partial<AppEventDraft> = {}): AppEventDraft {
  return {
    calendarId: 'calendar-1',
    kind: 'event',
    title: 'Plenum',
    location: null,
    note: null,
    start: { kind: 'zoned', value: '2026-09-07T18:00:00', timeZone: 'Europe/Vienna' },
    end: { kind: 'zoned', value: '2026-09-07T20:00:00', timeZone: 'Europe/Vienna' },
    rrule: 'FREQ=WEEKLY;BYDAY=MO;COUNT=6',
    ...overrides,
  };
}

describe('AppEventEditingInteractor', () => {
  let database: InMemorySqliteDatabase;
  let interactor: AppEventEditingInteractor;
  let items: AppCalendarItemDao;

  beforeEach(async () => {
    database = new InMemorySqliteDatabase();
    database.migrate(MIGRATIONS);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: SQLITE_DATABASE, useValue: database },
        // These tests only ever target the app calendar; a stub keeps the real plugin (which
        // fails `ngOnDestroy()` under jsdom) out of the picture entirely.
        { provide: CAPACITOR_CALENDAR, useValue: {} },
      ],
    });

    interactor = TestBed.inject(AppEventEditingInteractor);
    items = TestBed.inject(AppCalendarItemDao);

    const sources = TestBed.inject(CalendarSourceDao);
    await sources.insertSource({
      id: 'source-1',
      type: 'app',
      name: 'App',
      enabled: true,
      state: 'ok',
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });
    await sources.insertCalendar({
      id: 'calendar-1',
      sourceId: 'source-1',
      name: 'Termine',
      color: null,
      emoji: null,
      enabled: true,
      writable: true,
      externalId: null,
      nativeSourceId: null,
      nativeSourceName: null,
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });
  });

  afterEach(() => {
    database.close();
  });

  it('creates an item with a generated id, trimmed title and timestamps', async () => {
    const id = await interactor.create(draft({ title: '  Plenum  ' }));

    const stored = await items.find(id);
    expect(stored).not.toBeNull();
    expect(stored!.title).toBe('Plenum');
    expect(stored!.predecessorSeriesId).toBeNull();
  });

  it('rejects an empty title', async () => {
    await expect(interactor.create(draft({ title: '   ' }))).rejects.toBeInstanceOf(
      AppEventTitleInvalidError,
    );
  });

  it('bumps the rule revision only when the pattern changes', async () => {
    const id = await interactor.create(draft());

    await interactor.updateAll(id, { title: 'Neuer Titel' });
    expect((await items.find(id))!.ruleRevision).toBe(0);

    await interactor.updateAll(id, { rrule: 'FREQ=WEEKLY;BYDAY=TU' });
    expect((await items.find(id))!.ruleRevision).toBe(1);
  });

  it('splits a series on updateFollowing: continuation with what is left of COUNT, linked to its predecessor', async () => {
    const id = await interactor.create(draft());

    await interactor.updateFollowing(id, '2026-09-21T18:00:00', { title: 'Plenum (neu)' });

    const all = await items.listAll();
    const continuation = all.find((item) => item.predecessorSeriesId === id);
    expect(continuation).toBeDefined();
    expect(continuation!.title).toBe('Plenum (neu)');
    // 7 and 14 September came before the split, so 4 of the 6 occurrences are left.
    expect(continuation!.rrule).toBe('FREQ=WEEKLY;COUNT=4;BYDAY=MO');
    expect(continuation!.start.value).toBe('2026-09-21T18:00:00');
    // Master duration carried onto the continuation start.
    expect(continuation!.end?.value).toBe('2026-09-21T20:00:00');

    const master = await items.find(id);
    expect(master!.rrule).toContain('UNTIL=');
  });

  it('keeps UNTIL on the continuation of a series that ends on a day', async () => {
    const id = await interactor.create(
      draft({ rrule: 'FREQ=WEEKLY;BYDAY=MO;UNTIL=20261012T215959Z' }),
    );

    await interactor.updateFollowing(id, '2026-09-21T18:00:00', { title: 'Plenum (neu)' });

    const continuation = (await items.listAll()).find((item) => item.predecessorSeriesId === id);
    expect(continuation!.rrule).toBe('FREQ=WEEKLY;BYDAY=MO;UNTIL=20261012T215959Z');
  });

  it('anchors a changed rule on the continuation, which is its first occurrence', async () => {
    const id = await interactor.create(draft({ rrule: 'FREQ=WEEKLY;BYDAY=MO,TH' }));

    // Opened on Thursday 24 September, a rule authored against the Monday series start.
    await interactor.updateFollowing(id, '2026-09-24T18:00:00', {
      rrule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO',
    });

    const continuation = (await items.listAll()).find((item) => item.predecessorSeriesId === id);
    expect(continuation!.rrule).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH');
  });

  it('moves the weekdays along when all occurrences move to another day', async () => {
    const id = await interactor.create(draft({ rrule: 'FREQ=WEEKLY;BYDAY=MO,TH' }));

    await interactor.updateSeries(
      id,
      { kind: 'zoned', value: '2026-09-21T18:00:00', timeZone: 'Europe/Vienna' },
      {
        start: { kind: 'zoned', value: '2026-09-22T18:00:00', timeZone: 'Europe/Vienna' },
        end: { kind: 'zoned', value: '2026-09-22T20:00:00', timeZone: 'Europe/Vienna' },
      },
    );

    const stored = await items.find(id);
    expect(stored!.start.value).toBe('2026-09-08T18:00:00');
    expect(stored!.rrule).toBe('FREQ=WEEKLY;BYDAY=TU,FR');
  });

  it('moves the whole series by the shift made on one of its occurrences', async () => {
    const id = await interactor.create(draft());

    // The third occurrence (Monday 21 September) moved to Tuesday 19:00-21:00.
    await interactor.updateSeries(
      id,
      { kind: 'zoned', value: '2026-09-21T18:00:00', timeZone: 'Europe/Vienna' },
      {
        start: { kind: 'zoned', value: '2026-09-22T19:00:00', timeZone: 'Europe/Vienna' },
        end: { kind: 'zoned', value: '2026-09-22T21:00:00', timeZone: 'Europe/Vienna' },
        rrule: 'FREQ=WEEKLY;BYDAY=TU;COUNT=6',
      },
    );

    const stored = await items.find(id);
    expect(stored!.start.value).toBe('2026-09-08T19:00:00');
    expect(stored!.end?.value).toBe('2026-09-08T21:00:00');
    expect(stored!.rrule).toBe('FREQ=WEEKLY;BYDAY=TU;COUNT=6');
  });

  it('keeps the series start when an edit of all occurrences leaves the time alone', async () => {
    const id = await interactor.create(draft());

    await interactor.updateSeries(
      id,
      { kind: 'zoned', value: '2026-09-21T18:00:00', timeZone: 'Europe/Vienna' },
      { title: 'Plenum (neu)' },
    );

    const stored = await items.find(id);
    expect(stored!.title).toBe('Plenum (neu)');
    expect(stored!.start.value).toBe('2026-09-07T18:00:00');
    expect(stored!.ruleRevision).toBe(0);
  });

  it('stores a cancellation for only one occurrence', async () => {
    const id = await interactor.create(draft());

    await interactor.cancelOccurrence(id, '2026-09-14T18:00:00');

    const exceptions = await items.listExceptionsOfSeries(id);
    expect(exceptions).toHaveLength(1);
    expect(exceptions[0].status).toBe('cancelled');
  });
});

describe('AppEventEditingInteractor targeting a device calendar', () => {
  let database: InMemorySqliteDatabase;
  let interactor: AppEventEditingInteractor;
  let items: AppCalendarItemDao;
  let createdOptions: unknown;

  beforeEach(async () => {
    database = new InMemorySqliteDatabase();
    database.migrate(MIGRATIONS);
    createdOptions = undefined;

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: SQLITE_DATABASE, useValue: database },
        {
          provide: CAPACITOR_CALENDAR,
          useValue: {
            createEvent: async (options: unknown) => {
              createdOptions = options;
              return { id: 'native-event-1' };
            },
            checkPermission: async () => ({ result: 'granted' }),
            listCalendars: async () => ({ result: [] }),
            listEventsInRange: async () => ({ result: [] }),
          },
        },
      ],
    });

    interactor = TestBed.inject(AppEventEditingInteractor);
    items = TestBed.inject(AppCalendarItemDao);

    const sources = TestBed.inject(CalendarSourceDao);
    await sources.insertSource({
      id: 'device',
      type: 'device',
      name: 'Gerätekalender',
      enabled: true,
      state: 'ok',
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });
    await sources.insertCalendar({
      id: 'device-cal:cal-1',
      sourceId: 'device',
      name: 'Familie',
      color: '#ff0000',
      emoji: null,
      enabled: true,
      writable: true,
      externalId: 'cal-1',
      nativeSourceId: null,
      nativeSourceName: null,
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });
  });

  afterEach(() => {
    database.close();
  });

  it('writes the event straight into the OS calendar instead of a canonical app row', async () => {
    const id = await interactor.create(draft({ calendarId: 'device-cal:cal-1' }));

    expect(id).toBe('native-event-1');
    expect(createdOptions).toEqual(
      expect.objectContaining({ calendarId: 'cal-1', title: 'Plenum' }),
    );
    await expect(items.listAll()).resolves.toEqual([]);
  });

  it('turns a rule into a native series, always including the start weekday', async () => {
    await interactor.create(
      draft({
        calendarId: 'device-cal:cal-1',
        rrule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH;COUNT=6',
      }),
    );

    expect(createdOptions).toEqual(
      expect.objectContaining({
        recurrence: {
          frequency: 'weekly',
          interval: 2,
          byWeekDay: [1, 4],
          count: 6,
          end: undefined,
        },
      }),
    );
  });

  it('hands an all-day event to the OS with the exclusive end the gateway expects', async () => {
    // The draft's `date` end names the last day covered; `DeviceEventDraft.endUtc` is exclusive,
    // so a single-day all-day appointment reaches the gateway as the following midnight.
    await interactor.create(
      draft({
        calendarId: 'device-cal:cal-1',
        start: { kind: 'date', value: '2026-09-18', timeZone: null },
        end: { kind: 'date', value: '2026-09-18', timeZone: null },
        rrule: null,
      }),
    );

    const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const exclusiveEnd = Temporal.PlainDate.from('2026-09-19')
      .toZonedDateTime(deviceZone)
      .toInstant();
    expect(createdOptions).toEqual(
      expect.objectContaining({
        isAllDay: true,
        endDate: exclusiveEnd.epochMilliseconds,
      }),
    );
  });
});
