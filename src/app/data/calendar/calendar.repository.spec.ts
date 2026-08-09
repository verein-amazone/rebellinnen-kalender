import { TestBed } from '@angular/core/testing';

import { AppCalendarItemDao } from '../daos/app-calendar-item.dao';
import { CalendarSourceDao } from '../daos/calendar-source.dao';
import { OccurrenceDao } from '../daos/occurrence.dao';
import type { AppItemRecord } from '../entities/app-item.record';
import { SQLITE_DATABASE } from '../gateways/sqlite-database';
import { InMemorySqliteDatabase } from '../gateways/sqlite-database.testing';
import { MIGRATIONS } from '../migrations/migrations';
import { CalendarRepository, type CalendarContext } from './calendar.repository';

const CONTEXT: CalendarContext = {
  nowUtc: '2026-08-06T12:00:00Z',
  timeZone: 'Europe/Vienna',
};

function item(overrides: Partial<AppItemRecord> = {}): AppItemRecord {
  return {
    id: 'item-1',
    calendarId: 'calendar-1',
    kind: 'event',
    title: 'Plenum',
    location: null,
    note: null,
    start: { kind: 'zoned', value: '2026-09-07T18:00:00', timeZone: 'Europe/Vienna' },
    end: { kind: 'zoned', value: '2026-09-07T20:00:00', timeZone: 'Europe/Vienna' },
    rrule: 'FREQ=WEEKLY;BYDAY=MO;COUNT=4',
    predecessorSeriesId: null,
    ruleRevision: 0,
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('CalendarRepository', () => {
  let database: InMemorySqliteDatabase;
  let repository: CalendarRepository;
  let sources: CalendarSourceDao;
  let items: AppCalendarItemDao;
  let occurrences: OccurrenceDao;

  beforeEach(async () => {
    database = new InMemorySqliteDatabase();
    database.migrate(MIGRATIONS);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: SQLITE_DATABASE, useValue: database }],
    });

    repository = TestBed.inject(CalendarRepository);
    sources = TestBed.inject(CalendarSourceDao);
    items = TestBed.inject(AppCalendarItemDao);
    occurrences = TestBed.inject(OccurrenceDao);

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

  it('materializes a source into occurrence rows and records its coverage', async () => {
    await items.insert(item());

    await repository.rematerializeAppSource('source-1', CONTEXT);

    const rows = await occurrences.listInRange('2026-09-01T00:00:00Z', '2026-10-06T00:00:00Z');
    expect(rows).toHaveLength(4);
    expect(rows[0].id).toBe('app:item-1#2026-09-07T18:00:00');

    const coverage = await occurrences.findCoverage('source-1');
    expect(coverage).not.toBeNull();
    // -6/+18 months around now.
    expect(coverage!.windowStartUtc).toBe('2026-02-06T13:00:00Z');
    expect(coverage!.windowEndUtc).toBe('2028-02-06T13:00:00Z');
  });

  it('rebuilds deterministically: a second rebuild produces the same rows', async () => {
    await items.insert(item());

    await repository.rematerializeAppSource('source-1', CONTEXT);
    const first = await occurrences.listInRange('2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z');
    await repository.rematerializeAppSource('source-1', CONTEXT);
    const second = await occurrences.listInRange('2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z');

    expect(second).toEqual(first);
    // The rebuild replaced, not duplicated.
    expect(second).toHaveLength(4);
  });

  it('rebuilding derived rows leaves the canonical items untouched', async () => {
    await items.insert(item());

    await repository.rematerializeAppSource('source-1', CONTEXT);
    await repository.rematerializeAppSource('source-1', CONTEXT);

    await expect(items.find('item-1')).resolves.toEqual(item());
  });

  it('rematerializes one item and applies its exceptions', async () => {
    await items.insert(item());
    await repository.rematerializeItem('item-1', CONTEXT);
    await items.upsertException({
      seriesId: 'item-1',
      originalStart: '2026-09-14T18:00:00',
      status: 'cancelled',
      title: null,
      location: null,
      note: null,
      start: null,
      end: null,
      createdAt: '2026-08-02T10:00:00.000Z',
      updatedAt: '2026-08-02T10:00:00.000Z',
    });

    await repository.rematerializeItem('item-1', CONTEXT);

    const rows = await occurrences.listInRange('2026-09-01T00:00:00Z', '2026-10-06T00:00:00Z');
    expect(rows).toHaveLength(3);
    expect(rows.some((row) => row.originalStart === '2026-09-14T18:00:00')).toBe(false);
  });

  it('cleans up both shapes when an item switches between recurring and standalone', async () => {
    await items.insert(item());
    await repository.rematerializeItem('item-1', CONTEXT);

    await items.update(item({ rrule: null, updatedAt: '2026-08-02T10:00:00.000Z' }));
    await repository.rematerializeItem('item-1', CONTEXT);

    const rows = await occurrences.listInRange('2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z');
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('app:item-1');
  });

  it('creates and materializes an item in one unit of work', async () => {
    await repository.createItem(item(), CONTEXT);

    const rows = await occurrences.listInRange('2026-09-01T00:00:00Z', '2026-10-06T00:00:00Z');
    expect(rows).toHaveLength(4);
  });

  it('overrides only one occurrence and keeps its original identity', async () => {
    await repository.createItem(item(), CONTEXT);

    await repository.applyException(
      {
        seriesId: 'item-1',
        originalStart: '2026-09-14T18:00:00',
        status: 'override',
        title: null,
        location: null,
        note: null,
        start: { kind: 'zoned', value: '2026-09-16T09:00:00', timeZone: 'Europe/Vienna' },
        end: null,
        createdAt: '2026-08-02T10:00:00.000Z',
        updatedAt: '2026-08-02T10:00:00.000Z',
      },
      CONTEXT,
    );

    const rows = await occurrences.listInRange('2026-09-01T00:00:00Z', '2026-10-06T00:00:00Z');
    const moved = rows.find((row) => row.originalStart === '2026-09-14T18:00:00');
    expect(moved).toBeDefined();
    expect(moved!.id).toBe('app:item-1#2026-09-14T18:00:00');
    expect(moved!.provenance).toBe('overridden');
    expect(moved!.start.value).toBe('2026-09-16T09:00:00');
    // The canonical master is untouched; only the exception is authoritative.
    await expect(items.find('item-1')).resolves.toEqual(item());
  });

  it('cancels only one occurrence', async () => {
    await repository.createItem(item(), CONTEXT);

    await repository.applyException(
      {
        seriesId: 'item-1',
        originalStart: '2026-09-14T18:00:00',
        status: 'cancelled',
        title: null,
        location: null,
        note: null,
        start: null,
        end: null,
        createdAt: '2026-08-02T10:00:00.000Z',
        updatedAt: '2026-08-02T10:00:00.000Z',
      },
      CONTEXT,
    );

    const rows = await occurrences.listInRange('2026-09-01T00:00:00Z', '2026-10-06T00:00:00Z');
    expect(rows).toHaveLength(3);
  });

  it('splits a series: truncates the old, links the continuation, retargets compatible exceptions', async () => {
    await repository.createItem(item({ rrule: 'FREQ=WEEKLY;BYDAY=MO' }), CONTEXT);
    // A compatible exception in the tail (still a Monday under the unchanged continuation rule)…
    await repository.applyException(
      {
        seriesId: 'item-1',
        originalStart: '2026-09-28T18:00:00',
        status: 'override',
        title: 'Sondertermin',
        location: null,
        note: null,
        start: null,
        end: null,
        createdAt: '2026-08-02T10:00:00.000Z',
        updatedAt: '2026-08-02T10:00:00.000Z',
      },
      CONTEXT,
    );

    await repository.splitSeries(
      'item-1',
      '2026-09-21T18:00:00',
      item({
        id: 'item-2',
        title: 'Plenum (neu)',
        start: { kind: 'zoned', value: '2026-09-21T18:00:00', timeZone: 'Europe/Vienna' },
        end: { kind: 'zoned', value: '2026-09-21T20:00:00', timeZone: 'Europe/Vienna' },
        rrule: 'FREQ=WEEKLY;BYDAY=MO',
      }),
      CONTEXT,
    );

    const oldMaster = await items.find('item-1');
    expect(oldMaster!.rrule).toContain('UNTIL=');
    expect(oldMaster!.ruleRevision).toBe(1);

    const continuation = await items.find('item-2');
    expect(continuation!.predecessorSeriesId).toBe('item-1');

    // The retargeted exception now belongs to the continuation.
    await expect(items.listExceptionsOfSeries('item-1')).resolves.toEqual([]);
    const retargeted = await items.listExceptionsOfSeries('item-2');
    expect(retargeted).toHaveLength(1);
    expect(retargeted[0].originalStart).toBe('2026-09-28T18:00:00');

    const rows = await occurrences.listInRange('2026-09-01T00:00:00Z', '2026-10-06T00:00:00Z');
    const oldRows = rows.filter((row) => row.seriesId === 'item-1');
    const newRows = rows.filter((row) => row.seriesId === 'item-2');
    expect(oldRows.map((row) => row.originalStart)).toEqual([
      '2026-09-07T18:00:00',
      '2026-09-14T18:00:00',
    ]);
    expect(newRows.map((row) => row.originalStart)).toEqual([
      '2026-09-21T18:00:00',
      '2026-09-28T18:00:00',
      '2026-10-05T18:00:00',
    ]);
    expect(newRows[0].title).toBe('Plenum (neu)');
    expect(newRows[1].title).toBe('Sondertermin');
  });

  it('drops tail exceptions the continuation rule no longer generates', async () => {
    await repository.createItem(item({ rrule: 'FREQ=WEEKLY;BYDAY=MO' }), CONTEXT);
    await repository.applyException(
      {
        seriesId: 'item-1',
        originalStart: '2026-09-28T18:00:00',
        status: 'override',
        title: 'Sondertermin',
        location: null,
        note: null,
        start: null,
        end: null,
        createdAt: '2026-08-02T10:00:00.000Z',
        updatedAt: '2026-08-02T10:00:00.000Z',
      },
      CONTEXT,
    );

    // The continuation moves to Fridays; a Monday exception has no occurrence to anchor to.
    await repository.splitSeries(
      'item-1',
      '2026-09-21T18:00:00',
      item({
        id: 'item-2',
        start: { kind: 'zoned', value: '2026-09-25T18:00:00', timeZone: 'Europe/Vienna' },
        end: { kind: 'zoned', value: '2026-09-25T20:00:00', timeZone: 'Europe/Vienna' },
        rrule: 'FREQ=WEEKLY;BYDAY=FR',
      }),
      CONTEXT,
    );

    await expect(items.listExceptionsOfSeries('item-1')).resolves.toEqual([]);
    await expect(items.listExceptionsOfSeries('item-2')).resolves.toEqual([]);
  });

  it('deletes this and following occurrences by truncating the series', async () => {
    await repository.createItem(item({ rrule: 'FREQ=WEEKLY;BYDAY=MO' }), CONTEXT);

    await repository.deleteFollowing('item-1', '2026-09-21T18:00:00', CONTEXT);

    const rows = await occurrences.listInRange('2026-09-01T00:00:00Z', '2027-01-01T00:00:00Z');
    expect(rows.map((row) => row.originalStart)).toEqual([
      '2026-09-07T18:00:00',
      '2026-09-14T18:00:00',
    ]);
  });

  it('prunes exceptions that a rule change makes unanchorable, and keeps compatible ones', async () => {
    await repository.createItem(item({ rrule: 'FREQ=WEEKLY;BYDAY=MO' }), CONTEXT);
    await repository.applyException(
      {
        seriesId: 'item-1',
        originalStart: '2026-09-14T18:00:00',
        status: 'override',
        title: 'Bleibt',
        location: null,
        note: null,
        start: null,
        end: null,
        createdAt: '2026-08-02T10:00:00.000Z',
        updatedAt: '2026-08-02T10:00:00.000Z',
      },
      CONTEXT,
    );

    // Same weekday, so the exception stays anchored; the title change touches every occurrence.
    const master = await items.find('item-1');
    await repository.updateItem(
      { ...master!, title: 'Neuer Titel', updatedAt: '2026-08-03T10:00:00.000Z' },
      CONTEXT,
    );
    await expect(items.listExceptionsOfSeries('item-1')).resolves.toHaveLength(1);

    // Now the series moves to Fridays: the Monday exception loses its anchor and is dropped.
    const renamed = await items.find('item-1');
    await repository.updateItem(
      {
        ...renamed!,
        rrule: 'FREQ=WEEKLY;BYDAY=FR',
        ruleRevision: renamed!.ruleRevision + 1,
        updatedAt: '2026-08-04T10:00:00.000Z',
      },
      CONTEXT,
    );

    await expect(items.listExceptionsOfSeries('item-1')).resolves.toEqual([]);
  });

  it('deletes an entire series including exceptions and derived rows', async () => {
    await repository.createItem(item(), CONTEXT);
    await repository.applyException(
      {
        seriesId: 'item-1',
        originalStart: '2026-09-14T18:00:00',
        status: 'cancelled',
        title: null,
        location: null,
        note: null,
        start: null,
        end: null,
        createdAt: '2026-08-02T10:00:00.000Z',
        updatedAt: '2026-08-02T10:00:00.000Z',
      },
      CONTEXT,
    );

    await repository.deleteItem('item-1');

    await expect(items.find('item-1')).resolves.toBeNull();
    await expect(items.listExceptionsOfSeries('item-1')).resolves.toEqual([]);
    await expect(
      occurrences.listInRange('2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z'),
    ).resolves.toEqual([]);
  });

  it('returns unified occurrences with ownership-derived capabilities and staleness', async () => {
    await repository.createItem(item({ rrule: null }), CONTEXT);

    const rows = await repository.occurrencesInRange(
      '2026-09-01T00:00:00Z',
      '2026-10-01T00:00:00Z',
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].capabilities).toEqual({
      editableInApp: true,
      deletableInApp: true,
      editViaNativeCalendar: false,
    });
    expect(rows[0].sourceState).toBe('ok');
    expect(rows[0].calendarName).toBe('Termine');
  });

  it('finds one occurrence by id with the same joined shape as the range query', async () => {
    await repository.createItem(item({ rrule: null }), CONTEXT);

    const found = await repository.occurrenceById('app:item-1');

    expect(found).not.toBeNull();
    expect(found!.itemId).toBe('item-1');
    expect(found!.capabilities).toEqual({
      editableInApp: true,
      deletableInApp: true,
      editViaNativeCalendar: false,
    });
    expect(found!.calendarName).toBe('Termine');
  });

  it('returns null for an occurrence id that does not exist', async () => {
    await expect(repository.occurrenceById('does-not-exist')).resolves.toBeNull();
  });

  it('hides occurrences of disabled sources and calendars', async () => {
    await repository.createItem(item({ rrule: null }), CONTEXT);

    await sources.updateSourceEnabled('source-1', false, '2026-08-02T10:00:00.000Z');
    await expect(
      repository.occurrencesInRange('2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z'),
    ).resolves.toEqual([]);

    await sources.updateSourceEnabled('source-1', true, '2026-08-02T11:00:00.000Z');
    await sources.updateCalendarEnabled('calendar-1', false, '2026-08-02T11:00:00.000Z');
    await expect(
      repository.occurrencesInRange('2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z'),
    ).resolves.toEqual([]);
  });

  it('narrows a range query to the requested sources', async () => {
    await repository.createItem(item({ rrule: null }), CONTEXT);

    await expect(
      repository.occurrencesInRange('2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z', {
        sourceIds: ['other-source'],
      }),
    ).resolves.toEqual([]);
    await expect(
      repository.occurrencesInRange('2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z', {
        sourceIds: ['source-1'],
      }),
    ).resolves.toHaveLength(1);
  });

  it('extends coverage and materializes further occurrences when a query nears the edge', async () => {
    // An unbounded weekly series: rows exist only inside the covered window.
    await repository.createItem(item({ rrule: 'FREQ=WEEKLY;BYDAY=MO' }), CONTEXT);
    const before = await occurrences.findCoverage('source-1');

    // The default window ends 2028-02-06; query a month straddling that edge.
    await repository.extendCoverageForRange(
      '2028-01-20T00:00:00Z',
      '2028-02-20T00:00:00Z',
      CONTEXT,
    );

    const after = await occurrences.findCoverage('source-1');
    expect(after!.windowEndUtc > before!.windowEndUtc).toBe(true);

    const beyond = await occurrences.listInRange('2028-02-06T13:00:00Z', '2028-04-01T00:00:00Z');
    expect(beyond.length).toBeGreaterThan(0);
  });

  it('never commits a widened coverage window without the rows that fill it', async () => {
    await repository.createItem(item({ rrule: 'FREQ=WEEKLY;BYDAY=MO' }), CONTEXT);
    const before = await occurrences.findCoverage('source-1');

    // Corrupt the canonical rule directly (bypassing the interactor's validation) so
    // rematerialization throws partway through the widened rebuild.
    const master = await items.find('item-1');
    await items.update({ ...master!, rrule: 'FREQ=BOGUS' });

    await expect(
      repository.extendCoverageForRange('2028-01-20T00:00:00Z', '2028-02-20T00:00:00Z', CONTEXT),
    ).rejects.toThrow();

    // Coverage and rows both roll back together — the old window stays in force, never a wider
    // one with nothing materialized inside it.
    await expect(occurrences.findCoverage('source-1')).resolves.toEqual(before);
  });

  it('leaves coverage alone when the queried range is far from every edge', async () => {
    await repository.createItem(item({ rrule: 'FREQ=WEEKLY;BYDAY=MO' }), CONTEXT);
    const before = await occurrences.findCoverage('source-1');

    await repository.extendCoverageForRange(
      '2026-09-01T00:00:00Z',
      '2026-10-01T00:00:00Z',
      CONTEXT,
    );

    await expect(occurrences.findCoverage('source-1')).resolves.toEqual(before);
  });

  it('rebuilds all derived rows without losing canonical data', async () => {
    await repository.createItem(item(), CONTEXT);

    await repository.rebuildAllDerived(CONTEXT);

    await expect(items.find('item-1')).resolves.toEqual(item());
    await expect(
      occurrences.listInRange('2026-09-01T00:00:00Z', '2026-10-06T00:00:00Z'),
    ).resolves.toHaveLength(4);
  });

  it('detects rows generated by an older recurrence engine', async () => {
    await repository.createItem(item(), CONTEXT);
    await expect(repository.hasOutdatedEngineRows()).resolves.toBe(false);

    await occurrences.upsertCoverage({
      sourceId: 'source-1',
      windowStartUtc: '2026-02-06T13:00:00Z',
      windowEndUtc: '2028-02-06T13:00:00Z',
      engineVersion: 'rrule-temporal@0.0.1',
      updatedAt: '2026-08-06T12:00:00Z',
    });

    await expect(repository.hasOutdatedEngineRows()).resolves.toBe(true);
  });

  it('removes the derived rows of a deleted item', async () => {
    await items.insert(item());
    await repository.rematerializeItem('item-1', CONTEXT);

    await items.delete('item-1');
    await repository.rematerializeItem('item-1', CONTEXT);

    await expect(
      occurrences.listInRange('2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z'),
    ).resolves.toEqual([]);
  });
});
