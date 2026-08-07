import { TestBed } from '@angular/core/testing';

import { AppCalendarItemDao } from '@app/data/daos/app-calendar-item.dao';
import { CalendarSourceDao } from '@app/data/daos/calendar-source.dao';
import { SQLITE_DATABASE } from '@app/data/gateways/sqlite-database';
import { InMemorySqliteDatabase } from '@app/data/gateways/sqlite-database.testing';
import { MIGRATIONS } from '@app/data/migrations/migrations';
import {
  AppEventEditingInteractor,
  AppEventTitleInvalidError,
  type AppEventDraft,
} from './app-event-editing.interactor';

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
      providers: [{ provide: SQLITE_DATABASE, useValue: database }],
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

  it('splits a series on updateFollowing: continuation without the old COUNT, linked to its predecessor', async () => {
    const id = await interactor.create(draft());

    await interactor.updateFollowing(id, '2026-09-21T18:00:00', { title: 'Plenum (neu)' });

    const all = await items.listAll();
    const continuation = all.find((item) => item.predecessorSeriesId === id);
    expect(continuation).toBeDefined();
    expect(continuation!.title).toBe('Plenum (neu)');
    expect(continuation!.rrule).toBe('FREQ=WEEKLY;BYDAY=MO');
    expect(continuation!.start.value).toBe('2026-09-21T18:00:00');
    // Master duration carried onto the continuation start.
    expect(continuation!.end?.value).toBe('2026-09-21T20:00:00');

    const master = await items.find(id);
    expect(master!.rrule).toContain('UNTIL=');
  });

  it('stores a cancellation for only one occurrence', async () => {
    const id = await interactor.create(draft());

    await interactor.cancelOccurrence(id, '2026-09-14T18:00:00');

    const exceptions = await items.listExceptionsOfSeries(id);
    expect(exceptions).toHaveLength(1);
    expect(exceptions[0].status).toBe('cancelled');
  });
});
