import { TestBed } from '@angular/core/testing';

import { CalendarRepository } from '@app/data/calendar/calendar.repository';
import { CalendarSourceDao } from '@app/data/daos/calendar-source.dao';
import { OccurrenceDao } from '@app/data/daos/occurrence.dao';
import { SQLITE_DATABASE } from '@app/data/gateways/sqlite-database';
import { InMemorySqliteDatabase } from '@app/data/gateways/sqlite-database.testing';
import {
  NativeCalendarGateway,
  type DeviceCalendar,
  type DeviceCalendarPermission,
  type DeviceEventInstance,
} from '@app/data/gateways/native-calendar.gateway';
import { MIGRATIONS } from '@app/data/migrations/migrations';
import { DEVICE_SOURCE_ID, DeviceCalendarSyncInteractor } from './device-calendar-sync.interactor';

class FakeNativeCalendarGateway {
  permission: DeviceCalendarPermission = 'granted';
  calendars: DeviceCalendar[] = [
    {
      id: 'cal-1',
      name: 'Familie',
      color: '#ff0000',
      writable: true,
      sourceId: null,
      sourceName: null,
    },
  ];
  instances: DeviceEventInstance[] = [
    {
      eventId: 'event-1',
      calendarId: 'cal-1',
      title: 'Zahnarzt',
      location: null,
      description: null,
      startUtc: '2026-08-10T08:00:00Z',
      endUtc: '2026-08-10T09:00:00Z',
      isAllDay: false,
      timeZone: null,
    },
  ];
  failNative = false;

  checkReadPermission(): Promise<DeviceCalendarPermission> {
    return Promise.resolve(this.permission);
  }

  requestReadAccess(): Promise<DeviceCalendarPermission> {
    return Promise.resolve(this.permission);
  }

  listCalendars(): Promise<DeviceCalendar[]> {
    if (this.failNative) {
      return Promise.reject(new Error('native failure'));
    }
    return Promise.resolve(this.calendars);
  }

  listEventInstances(): Promise<DeviceEventInstance[]> {
    if (this.failNative) {
      return Promise.reject(new Error('native failure'));
    }
    return Promise.resolve(this.instances);
  }
}

describe('DeviceCalendarSyncInteractor', () => {
  let database: InMemorySqliteDatabase;
  let interactor: DeviceCalendarSyncInteractor;
  let gateway: FakeNativeCalendarGateway;
  let sources: CalendarSourceDao;
  let occurrences: OccurrenceDao;
  let repository: CalendarRepository;

  beforeEach(async () => {
    database = new InMemorySqliteDatabase();
    database.migrate(MIGRATIONS);
    gateway = new FakeNativeCalendarGateway();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: SQLITE_DATABASE, useValue: database },
        { provide: NativeCalendarGateway, useValue: gateway },
      ],
    });

    interactor = TestBed.inject(DeviceCalendarSyncInteractor);
    sources = TestBed.inject(CalendarSourceDao);
    occurrences = TestBed.inject(OccurrenceDao);
    repository = TestBed.inject(CalendarRepository);

    await interactor.ensureSource();
  });

  afterEach(() => {
    database.close();
  });

  it('connect loads calendars and instances into the cache', async () => {
    await interactor.connect();

    const calendars = await sources.listCalendarsOfSource(DEVICE_SOURCE_ID);
    expect(calendars).toHaveLength(1);
    expect(calendars[0].externalId).toBe('cal-1');
    expect(calendars[0].writable).toBe(true);

    const rows = await occurrences.listInRange('2026-08-01T00:00:00Z', '2026-08-31T00:00:00Z');
    expect(rows).toHaveLength(1);
    expect(rows[0].provenance).toBe('device-cached');

    const source = await repository.findSource(DEVICE_SOURCE_ID);
    expect(source!.state).toBe('ok');
  });

  it('leaves the cache untouched when the device handed back the same events', async () => {
    await interactor.connect();
    const before = await occurrences.listInRange('2026-08-01T00:00:00Z', '2026-08-31T00:00:00Z');

    // Reordered on purpose: a provider is free to return the same events in another order, and that
    // must not count as a change.
    gateway.instances = [...gateway.instances].reverse();
    const changed = await interactor.refresh({ force: true });

    expect(changed).toBe(false);
    await expect(
      occurrences.listInRange('2026-08-01T00:00:00Z', '2026-08-31T00:00:00Z'),
    ).resolves.toEqual(before);
  });

  it('reports a change and rewrites the rows when an event actually moved', async () => {
    await interactor.connect();
    gateway.instances = [{ ...gateway.instances[0], title: 'Zahnarzt (verschoben)' }];

    await expect(interactor.refresh({ force: true })).resolves.toBe(true);

    const rows = await occurrences.listInRange('2026-08-01T00:00:00Z', '2026-08-31T00:00:00Z');
    expect(rows.map((row) => row.title)).toEqual(['Zahnarzt (verschoben)']);
  });

  it('rebuilds when the rows went missing even though the device data did not change', async () => {
    await interactor.connect();

    // Stands in for any path that removes cached rows without clearing the fingerprint. The count
    // check is what has to notice, since the fingerprint alone would still match.
    await occurrences.deleteOfSource(DEVICE_SOURCE_ID);

    await expect(interactor.refresh({ force: true })).resolves.toBe(true);
    await expect(
      occurrences.listInRange('2026-08-01T00:00:00Z', '2026-08-31T00:00:00Z'),
    ).resolves.toHaveLength(1);
  });

  it('a refresh replaces the range instead of duplicating it', async () => {
    await interactor.connect();
    gateway.instances = [
      {
        ...gateway.instances[0],
        startUtc: '2026-08-11T08:00:00Z',
        endUtc: '2026-08-11T09:00:00Z',
      },
    ];

    await interactor.refresh({ force: true });

    const rows = await occurrences.listInRange('2026-08-01T00:00:00Z', '2026-08-31T00:00:00Z');
    expect(rows).toHaveLength(1);
    expect(rows[0].startUtc).toBe('2026-08-11T08:00:00Z');
  });

  it('a calendar removed on the device takes its cached rows with it', async () => {
    await interactor.connect();
    gateway.calendars = [];
    gateway.instances = [];

    await interactor.refresh({ force: true });

    await expect(sources.listCalendarsOfSource(DEVICE_SOURCE_ID)).resolves.toEqual([]);
    await expect(
      occurrences.listInRange('2026-08-01T00:00:00Z', '2026-08-31T00:00:00Z'),
    ).resolves.toEqual([]);
  });

  it('permission loss keeps the cache and flags the source', async () => {
    await interactor.connect();
    gateway.permission = 'denied';

    await interactor.refresh({ force: true });

    const source = await repository.findSource(DEVICE_SOURCE_ID);
    expect(source!.state).toBe('permission-lost');
    await expect(
      occurrences.listInRange('2026-08-01T00:00:00Z', '2026-08-31T00:00:00Z'),
    ).resolves.toHaveLength(1);
  });

  it('a native failure keeps the cache and marks the source as failing', async () => {
    await interactor.connect();
    gateway.failNative = true;

    await interactor.refresh({ force: true });

    const source = await repository.findSource(DEVICE_SOURCE_ID);
    expect(source!.state).toBe('error');
    await expect(
      occurrences.listInRange('2026-08-01T00:00:00Z', '2026-08-31T00:00:00Z'),
    ).resolves.toHaveLength(1);
  });

  it('lets a forced refresh reset the debounce window, so an automatic one does not redo it', async () => {
    await interactor.connect();

    // `connect()` ends in a forced refresh. An automatic trigger arriving right behind it has
    // nothing new to fetch and must back off rather than repeat the whole native read.
    await expect(interactor.refresh()).resolves.toBe(false);
  });

  it('a thrown permission check (e.g. the unimplemented web plugin) marks the source as failing without throwing', async () => {
    await interactor.connect();
    gateway.checkReadPermission = () => Promise.reject(new Error('not implemented on web'));

    // Resolves rather than throwing, and reports that nothing was cached.
    await expect(interactor.refresh({ force: true })).resolves.toBe(false);

    const source = await repository.findSource(DEVICE_SOURCE_ID);
    expect(source!.state).toBe('error');
    await expect(
      occurrences.listInRange('2026-08-01T00:00:00Z', '2026-08-31T00:00:00Z'),
    ).resolves.toHaveLength(1);
  });
});
