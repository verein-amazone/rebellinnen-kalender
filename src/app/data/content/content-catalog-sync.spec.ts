import { TestBed } from '@angular/core/testing';

import { BookmarkDao } from '../daos/bookmark.dao';
import { ContentItemDao } from '../daos/content-item.dao';
import { SQLITE_DATABASE } from '../gateways/sqlite-database';
import { InMemorySqliteDatabase } from '../gateways/sqlite-database.testing';
import { MIGRATIONS } from '../migrations/migrations';
import { ContentCatalogStore } from '../stores/content-catalog.store';
import { ContentCatalogSync, type Catalog } from './content-catalog-sync';

function catalogEntry(overrides: Partial<Catalog['items'][number]> = {}): Catalog['items'][number] {
  return {
    id: 'wi-01',
    kind: 'wissensimpulse',
    title: 'Was tut dir gut?',
    teaser: 'Wir haben ein paar Ideen für dich!',
    bodyMarkdown: '- Ein Bad nehmen',
    imageAttribution: 'Verein Amazone',
    sourceLabel: null,
    sourceUrl: null,
    validFrom: null,
    validTo: null,
    eligibleForDaily: true,
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

describe('ContentCatalogSync', () => {
  let database: InMemorySqliteDatabase;
  let sync: ContentCatalogSync;
  let contentItems: ContentItemDao;
  let bookmarks: BookmarkDao;
  let store: ContentCatalogStore;

  beforeEach(() => {
    database = new InMemorySqliteDatabase();
    database.migrate(MIGRATIONS);
    localStorage.clear();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: SQLITE_DATABASE, useValue: database }],
    });

    sync = TestBed.inject(ContentCatalogSync);
    contentItems = TestBed.inject(ContentItemDao);
    bookmarks = TestBed.inject(BookmarkDao);
    store = TestBed.inject(ContentCatalogStore);
  });

  afterEach(() => {
    database.close();
    vi.unstubAllGlobals();
  });

  it('inserts every catalog item into an empty database', async () => {
    mockFetch({ version: 1, items: [catalogEntry(), catalogEntry({ id: 'reb-01' })] });

    await sync.ensureSynced();

    expect((await contentItems.listIds()).sort()).toEqual(['reb-01', 'wi-01']);
    expect(store.syncedVersion()).toBe(1);
  });

  it('does nothing when the stored version already matches the catalog version', async () => {
    mockFetch({ version: 2, items: [catalogEntry()] });
    await sync.ensureSynced();
    await contentItems.upsert({
      id: 'wi-01',
      kind: 'wissensimpulse',
      title: 'Von Hand geändert',
      teaser: 't',
      bodyMarkdown: 'b',
      imagePath: null,
      imageAttribution: null,
      sourceLabel: null,
      sourceUrl: null,
      relatedSources: [],
      validFrom: null,
      validTo: null,
      eligibleForDaily: true,
    });

    await sync.ensureSynced();

    // Untouched: a matching version with items in place is the caught-up case, and reconciling
    // again would overwrite the row.
    expect((await contentItems.findById('wi-01'))?.title).toBe('Von Hand geändert');
  });

  it('reconciles again when the version matches but the items are gone', async () => {
    // The version lives in localStorage and the items in SQLite, so the two can drift apart - a
    // browser dropping IndexedDB on the web, or the dev-tools data reset. Trusting the version
    // alone would leave the app on an empty catalog forever.
    store.setSyncedVersion(2);
    mockFetch({ version: 2, items: [catalogEntry()] });

    await sync.ensureSynced();

    expect(await contentItems.listIds()).toEqual(['wi-01']);
  });

  it('updates a changed item in place and removes one no longer in the catalog', async () => {
    await contentItems.upsert({
      id: 'wi-01',
      kind: 'wissensimpulse',
      title: 'Alter Titel',
      teaser: 't',
      bodyMarkdown: 'b',
      imagePath: null,
      imageAttribution: null,
      sourceLabel: null,
      sourceUrl: null,
      relatedSources: [],
      validFrom: null,
      validTo: null,
      eligibleForDaily: true,
    });
    await contentItems.upsert({
      id: 'wi-99',
      kind: 'wissensimpulse',
      title: 'Wird entfernt',
      teaser: 't',
      bodyMarkdown: 'b',
      imagePath: null,
      imageAttribution: null,
      sourceLabel: null,
      sourceUrl: null,
      relatedSources: [],
      validFrom: null,
      validTo: null,
      eligibleForDaily: true,
    });
    await bookmarks.add('wi-99', '2026-08-21T09:00:00.000Z');

    mockFetch({ version: 3, items: [catalogEntry({ id: 'wi-01', title: 'Neuer Titel' })] });

    await sync.ensureSynced();

    expect((await contentItems.listIds()).sort()).toEqual(['wi-01']);
    await expect(contentItems.findById('wi-01')).resolves.toMatchObject({ title: 'Neuer Titel' });
    await expect(bookmarks.isBookmarked('wi-99')).resolves.toBe(false);
  });

  it('derives the image path from kind and id', async () => {
    mockFetch({
      version: 1,
      items: [
        catalogEntry({ id: 'wi-01', kind: 'wissensimpulse' }),
        catalogEntry({ id: 'reb-01', kind: 'rebellin' }),
      ],
    });

    await sync.ensureSynced();

    await expect(contentItems.findById('wi-01')).resolves.toMatchObject({
      imagePath: '/content/wissensimpulse/wi-01.webp',
    });
    await expect(contentItems.findById('reb-01')).resolves.toMatchObject({
      imagePath: '/content/rebellinnen/reb-01.webp',
    });
  });

  it('defaults related sources to an empty list when the catalog entry omits them', async () => {
    mockFetch({ version: 1, items: [catalogEntry()] });

    await sync.ensureSynced();

    await expect(contentItems.findById('wi-01')).resolves.toMatchObject({ relatedSources: [] });
  });

  it('carries related sources through from the catalog entry', async () => {
    const relatedSources = [{ title: 'Mehr erfahren', url: 'https://example.org/artikel' }];
    mockFetch({ version: 1, items: [catalogEntry({ relatedSources })] });

    await sync.ensureSynced();

    await expect(contentItems.findById('wi-01')).resolves.toMatchObject({ relatedSources });
  });

  it('does nothing and does not update the stored version when the fetch fails', async () => {
    mockFetch(null, false);

    await sync.ensureSynced();

    expect(store.syncedVersion()).toBeNull();
    expect(await contentItems.listIds()).toEqual([]);
  });

  it('does nothing when the fetched payload is not a valid catalog shape', async () => {
    // @ts-expect-error deliberately malformed for the test
    mockFetch({ items: 'not-an-array' });

    await sync.ensureSynced();

    expect(store.syncedVersion()).toBeNull();
  });
});
