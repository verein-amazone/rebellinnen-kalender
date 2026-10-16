import { TestBed } from '@angular/core/testing';

import { ContentCatalogStore } from './content-catalog.store';

const STORAGE_KEY = 'rk.contentCatalog';

describe('ContentCatalogStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('has no synced version when nothing is stored', () => {
    expect(TestBed.inject(ContentCatalogStore).syncedVersion()).toBeNull();
  });

  it('persists the synced version and exposes it', () => {
    const store = TestBed.inject(ContentCatalogStore);

    store.setSyncedVersion(3);

    expect(store.syncedVersion()).toBe(3);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toMatchObject({ version: 3 });
  });

  it('restores a persisted version for a new store instance', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 5 }));

    expect(TestBed.inject(ContentCatalogStore).syncedVersion()).toBe(5);
  });

  it('falls back to no synced version when the stored value is malformed', () => {
    localStorage.setItem(STORAGE_KEY, 'not json');

    expect(TestBed.inject(ContentCatalogStore).syncedVersion()).toBeNull();
  });
});
