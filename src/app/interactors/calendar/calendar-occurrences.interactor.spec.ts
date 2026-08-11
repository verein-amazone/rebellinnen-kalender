import { TestBed } from '@angular/core/testing';

import { CalendarRepository } from '@app/data/calendar/calendar.repository';
import { CalendarSourceDao } from '@app/data/daos/calendar-source.dao';
import { SQLITE_DATABASE } from '@app/data/gateways/sqlite-database';
import { InMemorySqliteDatabase } from '@app/data/gateways/sqlite-database.testing';
import { MIGRATIONS } from '@app/data/migrations/migrations';
import { CalendarOccurrencesInteractor } from './calendar-occurrences.interactor';

const CONTEXT = { nowUtc: '2026-08-06T12:00:00Z', timeZone: 'Europe/Vienna' };

describe('CalendarOccurrencesInteractor', () => {
  let database: InMemorySqliteDatabase;
  let interactor: CalendarOccurrencesInteractor;

  beforeEach(async () => {
    database = new InMemorySqliteDatabase();
    database.migrate(MIGRATIONS);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: SQLITE_DATABASE, useValue: database }],
    });

    interactor = TestBed.inject(CalendarOccurrencesInteractor);

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
      color: '#aa3377',
      emoji: '🌸',
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

  it('maps range rows into view models with actions and calendar identity', async () => {
    const repository = TestBed.inject(CalendarRepository);
    await repository.createItem(
      {
        id: 'item-1',
        calendarId: 'calendar-1',
        kind: 'event',
        title: 'Plenum',
        location: 'Vereinslokal',
        note: null,
        // Midday UTC keeps the day assignment identical in any plausible test-machine zone.
        start: { kind: 'utc', value: '2026-09-07T12:00:00Z', timeZone: null },
        end: { kind: 'utc', value: '2026-09-07T13:00:00Z', timeZone: null },
        rrule: null,
        predecessorSeriesId: null,
        ruleRevision: 0,
        createdAt: '2026-08-01T10:00:00.000Z',
        updatedAt: '2026-08-01T10:00:00.000Z',
      },
      CONTEXT,
    );

    const occurrences = await interactor.listForDays('2026-09-07', '2026-09-07');

    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]).toMatchObject({
      id: 'app:item-1',
      itemId: 'item-1',
      kind: 'event',
      title: 'Plenum',
      allDay: false,
      stale: false,
      calendarName: 'Termine',
      calendarEmoji: '🌸',
      actions: { editableInApp: true, deletableInApp: true, editViaNativeCalendar: false },
    });

    await expect(interactor.listForDays('2026-09-08', '2026-09-08')).resolves.toEqual([]);
  });

  it('finds one occurrence by id, or null when it does not exist', async () => {
    const repository = TestBed.inject(CalendarRepository);
    await repository.createItem(
      {
        id: 'item-1',
        calendarId: 'calendar-1',
        kind: 'event',
        title: 'Plenum',
        location: 'Vereinslokal',
        note: null,
        start: { kind: 'utc', value: '2026-09-07T12:00:00Z', timeZone: null },
        end: { kind: 'utc', value: '2026-09-07T13:00:00Z', timeZone: null },
        rrule: null,
        predecessorSeriesId: null,
        ruleRevision: 0,
        createdAt: '2026-08-01T10:00:00.000Z',
        updatedAt: '2026-08-01T10:00:00.000Z',
      },
      CONTEXT,
    );

    await expect(interactor.findById('app:item-1')).resolves.toMatchObject({
      id: 'app:item-1',
      itemId: 'item-1',
      title: 'Plenum',
    });
    await expect(interactor.findById('does-not-exist')).resolves.toBeNull();
  });
});
