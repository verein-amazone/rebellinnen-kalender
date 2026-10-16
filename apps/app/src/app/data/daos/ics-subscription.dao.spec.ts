import { TestBed } from '@angular/core/testing';

import type { CalendarSourceRecord } from '../entities/calendar-source.record';
import type { IcsSubscriptionRecord } from '../entities/ics.record';
import { SQLITE_DATABASE } from '../gateways/sqlite-database';
import { InMemorySqliteDatabase } from '../gateways/sqlite-database.testing';
import { MIGRATIONS } from '../migrations/migrations';
import { CalendarSourceDao } from './calendar-source.dao';
import { IcsSubscriptionDao } from './ics-subscription.dao';

function subscription(overrides: Partial<IcsSubscriptionRecord> = {}): IcsSubscriptionRecord {
  return {
    id: 'sub-1',
    url: 'https://example.org/verein.ics',
    allowInsecure: false,
    etag: null,
    lastModified: null,
    lastSuccessAt: null,
    lastCheckedAt: null,
    lastAttemptAt: null,
    lastError: null,
    activeRevisionId: null,
    createdAt: '2026-08-01T10:00:00Z',
    updatedAt: '2026-08-01T10:00:00Z',
    curatedId: null,
    ...overrides,
  };
}

function source(id: string, enabled: boolean): CalendarSourceRecord {
  return {
    id,
    type: 'ics',
    name: id,
    enabled,
    state: 'ok',
    createdAt: '2026-08-01T10:00:00Z',
    updatedAt: '2026-08-01T10:00:00Z',
  };
}

describe('IcsSubscriptionDao', () => {
  let database: InMemorySqliteDatabase;
  let dao: IcsSubscriptionDao;

  beforeEach(() => {
    database = new InMemorySqliteDatabase();
    database.migrate(MIGRATIONS);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: SQLITE_DATABASE, useValue: database }],
    });

    dao = TestBed.inject(IcsSubscriptionDao);
  });

  afterEach(() => {
    database.close();
  });

  it('round-trips a subscription', async () => {
    const record = subscription({
      allowInsecure: true,
      etag: '"abc"',
      lastModified: 'Tue, 13 Oct 2026 08:00:00 GMT',
      curatedId: 'feiertage-at',
    });

    await dao.insert(record);

    await expect(dao.find('sub-1')).resolves.toEqual(record);
    await expect(dao.findByCuratedId('feiertage-at')).resolves.toEqual(record);
  });

  it('finds nothing for an unknown id or curated id', async () => {
    await expect(dao.find('missing')).resolves.toBeNull();
    await expect(dao.findByCuratedId('missing')).resolves.toBeNull();
  });

  it('lists subscriptions in the order they were added', async () => {
    await dao.insert(subscription({ id: 'later', createdAt: '2026-08-02T10:00:00Z' }));
    await dao.insert(subscription({ id: 'earlier', createdAt: '2026-08-01T10:00:00Z' }));

    expect((await dao.list()).map(({ id }) => id)).toEqual(['earlier', 'later']);
  });

  it('lists only the subscriptions whose calendar source is switched on', async () => {
    const sources = TestBed.inject(CalendarSourceDao);
    await sources.insertSource(source('on', true));
    await sources.insertSource(source('off', false));
    await dao.insert(subscription({ id: 'on' }));
    await dao.insert(subscription({ id: 'off' }));
    await dao.insert(subscription({ id: 'without-source' }));

    expect((await dao.listEnabled()).map(({ id }) => id)).toEqual(['on']);
  });

  it('activates the new revision and keeps the document after a successful refresh', async () => {
    await dao.insert(subscription({ lastError: 'HTTP 500' }));

    await dao.recordSuccess(
      'sub-1',
      'rev-2',
      'BEGIN:VCALENDAR',
      '"v2"',
      null,
      '2026-08-03T10:00:00Z',
    );

    await expect(dao.find('sub-1')).resolves.toMatchObject({
      activeRevisionId: 'rev-2',
      etag: '"v2"',
      lastModified: null,
      lastSuccessAt: '2026-08-03T10:00:00Z',
      lastCheckedAt: '2026-08-03T10:00:00Z',
      lastAttemptAt: '2026-08-03T10:00:00Z',
      lastError: null,
      updatedAt: '2026-08-03T10:00:00Z',
    });
    await expect(dao.findRawIcs('sub-1')).resolves.toBe('BEGIN:VCALENDAR');
  });

  it('has no document before the first download', async () => {
    await dao.insert(subscription());

    await expect(dao.findRawIcs('sub-1')).resolves.toBeNull();
    await expect(dao.findRawIcs('missing')).resolves.toBeNull();
  });

  it('counts a not-modified answer as checked, but not as a new revision', async () => {
    await dao.insert(subscription({ activeRevisionId: 'rev-1', lastError: 'timeout' }));

    await dao.recordNotModified('sub-1', '2026-08-04T10:00:00Z');

    await expect(dao.find('sub-1')).resolves.toMatchObject({
      activeRevisionId: 'rev-1',
      lastSuccessAt: null,
      lastCheckedAt: '2026-08-04T10:00:00Z',
      lastAttemptAt: '2026-08-04T10:00:00Z',
      lastError: null,
    });
  });

  it('records a failed refresh without touching the active revision', async () => {
    await dao.insert(subscription({ activeRevisionId: 'rev-1' }));
    await dao.recordSuccess(
      'sub-1',
      'rev-1',
      'BEGIN:VCALENDAR',
      null,
      null,
      '2026-08-03T10:00:00Z',
    );

    await dao.recordFailure('sub-1', 'HTTP 404', '2026-08-05T10:00:00Z');

    await expect(dao.find('sub-1')).resolves.toMatchObject({
      activeRevisionId: 'rev-1',
      lastSuccessAt: '2026-08-03T10:00:00Z',
      lastCheckedAt: '2026-08-03T10:00:00Z',
      lastAttemptAt: '2026-08-05T10:00:00Z',
      lastError: 'HTTP 404',
    });
    await expect(dao.findRawIcs('sub-1')).resolves.toBe('BEGIN:VCALENDAR');
  });

  it('deletes a subscription', async () => {
    await dao.insert(subscription());

    await dao.delete('sub-1');

    await expect(dao.find('sub-1')).resolves.toBeNull();
  });
});
