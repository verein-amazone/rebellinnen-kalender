import { TestBed } from '@angular/core/testing';

import type { OccurrenceRecord } from '../entities/occurrence.record';
import { SQLITE_DATABASE } from '../gateways/sqlite-database';
import { InMemorySqliteDatabase } from '../gateways/sqlite-database.testing';
import { MIGRATIONS } from '../migrations/migrations';
import { OccurrenceDao } from './occurrence.dao';

function occurrence(overrides: Partial<OccurrenceRecord> = {}): OccurrenceRecord {
  return {
    id: 'app:item-1',
    sourceId: 'source-1',
    sourceType: 'app',
    calendarId: 'calendar-1',
    seriesId: null,
    originalStart: null,
    provenance: 'standalone',
    itemKind: 'event',
    itemId: 'item-1',
    title: 'Plenum',
    location: null,
    description: null,
    isAllDay: false,
    start: { kind: 'zoned', value: '2026-10-12T18:00:00', timeZone: 'Europe/Vienna' },
    end: { kind: 'zoned', value: '2026-10-12T20:00:00', timeZone: 'Europe/Vienna' },
    startUtc: '2026-10-12T16:00:00Z',
    endUtc: '2026-10-12T18:00:00Z',
    startLocalDay: '2026-10-12',
    endLocalDay: '2026-10-12',
    externalId: null,
    ...overrides,
  };
}

describe('OccurrenceDao', () => {
  let database: InMemorySqliteDatabase;
  let dao: OccurrenceDao;

  beforeEach(() => {
    database = new InMemorySqliteDatabase();
    database.migrate(MIGRATIONS);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: SQLITE_DATABASE, useValue: database }],
    });

    dao = TestBed.inject(OccurrenceDao);
  });

  afterEach(() => {
    database.close();
  });

  it('round-trips a row', async () => {
    await dao.insertMany([occurrence()]);

    await expect(dao.listInRange('2026-10-12T00:00:00Z', '2026-10-13T00:00:00Z')).resolves.toEqual([
      occurrence(),
    ]);
  });

  it('inserts more rows than fit in one chunked statement', async () => {
    // Deliberately crosses the chunk boundary twice and lands mid-chunk, so a short final chunk is
    // exercised as well as the full ones.
    const records = Array.from({ length: 81 }, (_, index) =>
      occurrence({ id: `app:item-${index}`, itemId: `item-${index}` }),
    );

    await dao.insertMany(records);

    await expect(
      dao.listInRange('2026-10-12T00:00:00Z', '2026-10-13T00:00:00Z'),
    ).resolves.toHaveLength(81);
  });

  it('inserts nothing for an empty list', async () => {
    await expect(dao.insertMany([])).resolves.toBeUndefined();

    await expect(dao.listInRange('2026-10-12T00:00:00Z', '2026-10-13T00:00:00Z')).resolves.toEqual(
      [],
    );
  });

  it('matches ranges by interval overlap, not by containment', async () => {
    // Runs 16:00Z–18:00Z; the queried range starts inside it.
    await dao.insertMany([occurrence()]);

    const overlapping = await dao.listInRange('2026-10-12T17:00:00Z', '2026-10-13T00:00:00Z');
    const before = await dao.listInRange('2026-10-12T00:00:00Z', '2026-10-12T16:00:00Z');
    const after = await dao.listInRange('2026-10-12T18:00:00Z', '2026-10-13T00:00:00Z');

    expect(overlapping).toHaveLength(1);
    // Half-open: touching an edge is not overlapping.
    expect(before).toHaveLength(0);
    expect(after).toHaveLength(0);
  });

  it('includes a zero-length row at its instant', async () => {
    const point = occurrence({
      id: 'app:item-2',
      end: null,
      endUtc: '2026-10-12T16:00:00Z',
    });
    await dao.insertMany([point]);

    await expect(dao.listInRange('2026-10-12T16:00:00Z', '2026-10-13T00:00:00Z')).resolves.toEqual([
      point,
    ]);
    await expect(dao.listInRange('2026-10-12T17:00:00Z', '2026-10-13T00:00:00Z')).resolves.toEqual(
      [],
    );
  });

  it('orders a day all-day first, then by start, then title', async () => {
    await dao.insertMany([
      occurrence({ id: 'later', startUtc: '2026-10-12T18:30:00Z', title: 'Später' }),
      occurrence({
        id: 'all-day',
        isAllDay: true,
        startUtc: '2026-10-11T22:00:00Z',
        endUtc: '2026-10-12T22:00:00Z',
      }),
      occurrence({ id: 'b-title', title: 'B' }),
      occurrence({ id: 'a-title', title: 'A' }),
    ]);

    const rows = await dao.listInRange('2026-10-11T00:00:00Z', '2026-10-14T00:00:00Z');

    expect(rows.map((row) => row.id)).toEqual(['all-day', 'a-title', 'b-title', 'later']);
  });

  it('replaces only one source inside a range', async () => {
    await dao.insertMany([
      occurrence({ id: 'device-in-range', sourceId: 'device-source', sourceType: 'device' }),
      occurrence({
        id: 'device-outside',
        sourceId: 'device-source',
        sourceType: 'device',
        startUtc: '2026-11-01T16:00:00Z',
        endUtc: '2026-11-01T18:00:00Z',
      }),
      occurrence({ id: 'app-in-range' }),
    ]);

    await dao.deleteOfSourceInRange(
      'device-source',
      '2026-10-01T00:00:00Z',
      '2026-10-31T00:00:00Z',
    );

    const remaining = await dao.listInRange('2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z');
    expect(remaining.map((row) => row.id).sort()).toEqual(['app-in-range', 'device-outside']);
  });

  it('upserts and reads coverage per source', async () => {
    await dao.upsertCoverage({
      sourceId: 'source-1',
      windowStartUtc: '2026-02-06T00:00:00Z',
      windowEndUtc: '2028-02-06T00:00:00Z',
      engineVersion: 'rrule-temporal@2.0.2',
      updatedAt: '2026-08-06T12:00:00Z',
      contentFingerprint: null,
    });
    await dao.upsertCoverage({
      sourceId: 'source-1',
      windowStartUtc: '2026-02-06T00:00:00Z',
      windowEndUtc: '2028-08-06T00:00:00Z',
      engineVersion: 'rrule-temporal@2.0.2',
      updatedAt: '2026-08-07T12:00:00Z',
      contentFingerprint: null,
    });

    await expect(dao.findCoverage('source-1')).resolves.toEqual({
      sourceId: 'source-1',
      windowStartUtc: '2026-02-06T00:00:00Z',
      windowEndUtc: '2028-08-06T00:00:00Z',
      engineVersion: 'rrule-temporal@2.0.2',
      updatedAt: '2026-08-07T12:00:00Z',
      contentFingerprint: null,
    });
    await expect(dao.findCoverage('other')).resolves.toBeNull();
  });

  it('moves only the listed rows to their new local days, across a chunk boundary', async () => {
    const records = Array.from({ length: 160 }, (_, index) =>
      occurrence({ id: `app:item-${index}`, itemId: `item-${index}` }),
    );
    await dao.insertMany(records);

    // 151 assignments span two chunks; the untouched rows prove the `WHERE id IN (...)` bound.
    await dao.updateLocalDaysMany(
      records.slice(0, 151).map((record) => ({
        id: record.id,
        startLocalDay: '2026-10-13',
        endLocalDay: '2026-10-13',
      })),
    );

    const all = await dao.listInRange('2026-10-12T00:00:00Z', '2026-10-13T00:00:00Z');
    const moved = all.filter((row) => row.startLocalDay === '2026-10-13');
    const untouched = all.filter((row) => row.startLocalDay === '2026-10-12');

    expect(moved).toHaveLength(151);
    expect(untouched).toHaveLength(9);
    expect(moved.every((row) => row.endLocalDay === '2026-10-13')).toBe(true);
  });

  it('lists every source’s coverage in one read', async () => {
    await expect(dao.listCoverage()).resolves.toEqual([]);

    const coverage = (sourceId: string) => ({
      sourceId,
      windowStartUtc: '2026-02-06T00:00:00Z',
      windowEndUtc: '2028-02-06T00:00:00Z',
      engineVersion: 'rrule-temporal@2.0.2',
      updatedAt: '2026-08-06T12:00:00Z',
      contentFingerprint: null,
    });
    await dao.upsertCoverage(coverage('source-2'));
    await dao.upsertCoverage(coverage('source-1'));

    await expect(dao.listCoverage()).resolves.toEqual([coverage('source-1'), coverage('source-2')]);
  });

  it('finds one row by id, or null when it does not exist', async () => {
    await dao.insertMany([occurrence()]);

    await expect(dao.findOne('app:item-1')).resolves.toEqual(occurrence());
    await expect(dao.findOne('does-not-exist')).resolves.toBeNull();
  });
});
