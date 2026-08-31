import { TestBed } from '@angular/core/testing';

import { CalendarSourceDao } from '@app/data/daos/calendar-source.dao';
import { IcsSubscriptionDao } from '@app/data/daos/ics-subscription.dao';
import { SQLITE_DATABASE } from '@app/data/gateways/sqlite-database';
import { InMemorySqliteDatabase } from '@app/data/gateways/sqlite-database.testing';
import { MIGRATIONS } from '@app/data/migrations/migrations';
import { CuratedCalendarsStore } from '@app/data/stores/curated-calendars.store';

import { CuratedCalendarSync, type Catalog } from './curated-calendar-sync';

function catalogEntry(
  overrides: Partial<Catalog['sources'][number]> = {},
): Catalog['sources'][number] {
  return {
    id: 'at-public-holidays',
    name: 'Feiertage Österreich',
    description: 'Gesetzliche Feiertage in Österreich.',
    url: 'webcal://www.wien.gv.at/spezial/daten/ics/feiertage.ics',
    color: '#1565C0',
    emoji: '🇦🇹',
    ...overrides,
  };
}

function mockFetch(catalog: Catalog | null, ok = true): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: ok && catalog !== null,
      json: () => Promise.resolve(catalog),
    }),
  );
}

describe('CuratedCalendarSync', () => {
  let database: InMemorySqliteDatabase;
  let sync: CuratedCalendarSync;
  let sources: CalendarSourceDao;
  let subscriptions: IcsSubscriptionDao;
  let store: CuratedCalendarsStore;

  beforeEach(() => {
    database = new InMemorySqliteDatabase();
    database.migrate(MIGRATIONS);
    localStorage.clear();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: SQLITE_DATABASE, useValue: database }],
    });

    sync = TestBed.inject(CuratedCalendarSync);
    sources = TestBed.inject(CalendarSourceDao);
    subscriptions = TestBed.inject(IcsSubscriptionDao);
    store = TestBed.inject(CuratedCalendarsStore);
  });

  afterEach(() => {
    database.close();
    vi.unstubAllGlobals();
  });

  it('seeds a missing catalog entry as a curated ICS subscription', async () => {
    mockFetch({ version: 1, sources: [catalogEntry()] });

    const { catalog, createdSubscriptionIds } = await sync.ensureSynced();

    expect(catalog?.sources).toHaveLength(1);
    expect(createdSubscriptionIds).toHaveLength(1);

    const subscription = await subscriptions.find(createdSubscriptionIds[0]);
    expect(subscription).toMatchObject({
      url: 'https://www.wien.gv.at/spezial/daten/ics/feiertage.ics',
      curatedId: 'at-public-holidays',
    });

    const [calendarSource] = await sources.listSources();
    expect(calendarSource).toMatchObject({ type: 'ics', name: 'Feiertage Österreich' });
    const [calendar] = await sources.listCalendars();
    expect(calendar).toMatchObject({ color: '#1565C0', emoji: '🇦🇹', enabled: true });
    expect(store.syncedVersion()).toBe(1);
  });

  it('stamps seeded sources so catalog order survives the created_at sort', async () => {
    mockFetch({
      version: 1,
      sources: [
        catalogEntry({
          id: 'amazone',
          name: 'Rebell*innen Kalender',
          url: 'https://a.example/a.ics',
        }),
        catalogEntry(),
      ],
    });

    await sync.ensureSynced();

    // listSources() sorts by created_at, so equal timestamps would fall back to the random UUID.
    expect((await sources.listSources()).map((source) => source.name)).toEqual([
      'Rebell*innen Kalender',
      'Feiertage Österreich',
    ]);
  });

  it('is idempotent: a second sync at the same version creates nothing new', async () => {
    mockFetch({ version: 1, sources: [catalogEntry()] });
    await sync.ensureSynced();

    const { createdSubscriptionIds } = await sync.ensureSynced();

    expect(createdSubscriptionIds).toEqual([]);
    expect(await sources.listSources()).toHaveLength(1);
  });

  it('never overwrites a source the user has already recoloured or renamed', async () => {
    mockFetch({ version: 1, sources: [catalogEntry()] });
    await sync.ensureSynced();
    const [calendar] = await sources.listCalendars();
    await sources.updateCalendarIdentity(
      calendar.id,
      'Meine Feiertage',
      '#000000',
      '🎉',
      '2026-08-02T00:00:00.000Z',
    );

    // A version bump reconciles again, but the existing curated_id already has a row.
    store.setSyncedVersion(0);
    await sync.ensureSynced();

    const [unchanged] = await sources.listCalendars();
    expect(unchanged).toMatchObject({ name: 'Meine Feiertage', color: '#000000', emoji: '🎉' });
  });

  it('serializes concurrent calls so overlapping retries never create duplicate sources', async () => {
    mockFetch({ version: 1, sources: [catalogEntry()] });

    const [first, second, third] = await Promise.all([
      sync.ensureSynced(),
      sync.ensureSynced(),
      sync.ensureSynced(),
    ]);

    // All three concurrent callers await the exact same in-flight reconciliation.
    expect(first).toBe(second);
    expect(second).toBe(third);
    expect(first.createdSubscriptionIds).toHaveLength(1);
    expect(await sources.listSources()).toHaveLength(1);
  });

  it('never removes a source whose catalog entry disappears', async () => {
    mockFetch({ version: 1, sources: [catalogEntry()] });
    await sync.ensureSynced();

    mockFetch({ version: 2, sources: [] });
    await sync.ensureSynced();

    expect(await sources.listSources()).toHaveLength(1);
  });

  it('skips an entry with an invalid URL without failing the whole sync', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockFetch({
      version: 1,
      sources: [catalogEntry({ id: 'broken', url: 'not a link' }), catalogEntry()],
    });

    const { createdSubscriptionIds } = await sync.ensureSynced();

    expect(createdSubscriptionIds).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('does nothing when the fetch fails', async () => {
    mockFetch(null, false);

    const { catalog, createdSubscriptionIds } = await sync.ensureSynced();

    expect(catalog).toBeNull();
    expect(createdSubscriptionIds).toEqual([]);
    expect(store.syncedVersion()).toBeNull();
  });
});
