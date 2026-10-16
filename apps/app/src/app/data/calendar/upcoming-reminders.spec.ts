import { TestBed } from '@angular/core/testing';

import { CAPACITOR_CALENDAR } from '@app/cross-cutting/plugins/calendar.plugin';

import { CalendarSourceDao } from '../daos/calendar-source.dao';
import { SQLITE_DATABASE } from '../gateways/sqlite-database';
import { InMemorySqliteDatabase } from '../gateways/sqlite-database.testing';
import { MIGRATIONS } from '../migrations/migrations';
import { CalendarRepository } from './calendar.repository';

describe('CalendarRepository.upcomingReminderCandidates', () => {
  let database: InMemorySqliteDatabase;
  let repository: CalendarRepository;
  const context = { nowUtc: '2026-10-01T08:00:00.000Z', timeZone: 'Europe/Vienna' };

  beforeEach(async () => {
    database = new InMemorySqliteDatabase();
    database.migrate(MIGRATIONS);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: SQLITE_DATABASE, useValue: database },
        { provide: CAPACITOR_CALENDAR, useValue: {} },
      ],
    });
    repository = TestBed.inject(CalendarRepository);

    const sources = TestBed.inject(CalendarSourceDao);
    await sources.insertSource({
      id: 'source-1',
      type: 'app',
      name: 'App',
      enabled: true,
      state: 'ok',
      createdAt: context.nowUtc,
      updatedAt: context.nowUtc,
    });
    for (const [id, enabled] of [
      ['calendar-1', true],
      ['calendar-off', false],
    ] as const) {
      await sources.insertCalendar({
        id,
        sourceId: 'source-1',
        name: id,
        color: null,
        emoji: null,
        enabled,
        writable: true,
        externalId: null,
        nativeSourceId: null,
        nativeSourceName: null,
        createdAt: context.nowUtc,
        updatedAt: context.nowUtc,
      });
    }
  });

  afterEach(() => database.close());

  function createItem(
    id: string,
    calendarId: string,
    rrule: string | null,
    reminders: number[] | null,
  ) {
    return repository.createItem(
      {
        id,
        calendarId,
        kind: 'event',
        title: id,
        location: null,
        note: null,
        start: { kind: 'zoned', value: '2026-10-12T18:00:00', timeZone: 'Europe/Vienna' },
        end: { kind: 'zoned', value: '2026-10-12T19:00:00', timeZone: 'Europe/Vienna' },
        rrule,
        predecessorSeriesId: null,
        ruleRevision: 0,
        reminders,
        createdAt: context.nowUtc,
        updatedAt: context.nowUtc,
      },
      context,
    );
  }

  it('returns upcoming occurrences of enabled calendars with their item reminders, earliest first', async () => {
    await createItem('series', 'calendar-1', 'FREQ=WEEKLY;COUNT=3', [30]);
    await createItem('hidden', 'calendar-off', null, null);

    const candidates = await repository.upcomingReminderCandidates('2026-10-13T00:00:00Z', 10);

    expect(candidates.map((candidate) => [candidate.title, candidate.startUtc])).toEqual([
      ['series', '2026-10-19T16:00:00Z'],
      ['series', '2026-10-26T17:00:00Z'],
    ]);
    expect(candidates[0].reminders).toEqual([30]);
    expect(candidates[0].allDay).toBe(false);
  });

  it('applies the limit to enabled calendars only', async () => {
    // The hidden daily series comes first and would fill a limit applied before filtering.
    await createItem('hidden', 'calendar-off', 'FREQ=DAILY', null);
    await createItem('visible', 'calendar-1', 'FREQ=WEEKLY;COUNT=3', null);

    const candidates = await repository.upcomingReminderCandidates('2026-10-13T00:00:00Z', 2);

    expect(candidates.map((candidate) => candidate.title)).toEqual(['visible', 'visible']);
  });
});
