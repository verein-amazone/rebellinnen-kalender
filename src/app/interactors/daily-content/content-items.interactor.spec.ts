import { TestBed } from '@angular/core/testing';

import { ContentItemDao } from '@app/data/daos/content-item.dao';
import { ContentCatalogSync } from '@app/data/content/content-catalog-sync';
import type { ContentItemRecord } from '@app/data/entities/content-item.record';

import { ContentItemsInteractor } from './content-items.interactor';

class FakeContentItemDao {
  items = new Map<string, ContentItemRecord>();

  findById(id: string): Promise<ContentItemRecord | null> {
    return Promise.resolve(this.items.get(id) ?? null);
  }

  listAll(): Promise<ContentItemRecord[]> {
    return Promise.resolve([...this.items.values()]);
  }
}

class FakeContentCatalogSync {
  ensureSynced = vi.fn().mockResolvedValue(undefined);
}

describe('ContentItemsInteractor', () => {
  let dao: FakeContentItemDao;
  let sync: FakeContentCatalogSync;
  let interactor: ContentItemsInteractor;

  beforeEach(() => {
    dao = new FakeContentItemDao();
    sync = new FakeContentCatalogSync();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: ContentItemDao, useValue: dao },
        { provide: ContentCatalogSync, useValue: sync },
      ],
    });

    interactor = TestBed.inject(ContentItemsInteractor);
  });

  it('reconciles the catalog before reading', async () => {
    await interactor.findById('wi-01');

    expect(sync.ensureSynced).toHaveBeenCalled();
  });

  it('lists every content item', async () => {
    const record: ContentItemRecord = {
      id: 'wi-01',
      kind: 'wissensimpulse',
      title: 'Titel',
      teaser: 'Teaser',
      bodyMarkdown: 'Text',
      imagePath: null,
      imageAttribution: null,
      sourceLabel: null,
      sourceUrl: null,
      validFrom: null,
      validTo: null,
      eligibleForDaily: true,
    };
    dao.items.set('wi-01', record);

    await expect(interactor.listAll()).resolves.toEqual([
      {
        id: 'wi-01',
        kind: 'wissensimpulse',
        title: 'Titel',
        teaser: 'Teaser',
        bodyMarkdown: 'Text',
        imagePath: null,
        imageAttribution: null,
        sourceLabel: null,
        sourceUrl: null,
      },
    ]);
  });

  it('returns null for an unknown id', async () => {
    await expect(interactor.findById('does-not-exist')).resolves.toBeNull();
  });

  it('returns the item for a known id', async () => {
    const record: ContentItemRecord = {
      id: 'wi-01',
      kind: 'wissensimpulse',
      title: 'Titel',
      teaser: 'Teaser',
      bodyMarkdown: 'Text',
      imagePath: null,
      imageAttribution: null,
      sourceLabel: null,
      sourceUrl: null,
      validFrom: null,
      validTo: null,
      eligibleForDaily: true,
    };
    dao.items.set('wi-01', record);

    await expect(interactor.findById('wi-01')).resolves.toEqual({
      id: 'wi-01',
      kind: 'wissensimpulse',
      title: 'Titel',
      teaser: 'Teaser',
      bodyMarkdown: 'Text',
      imagePath: null,
      imageAttribution: null,
      sourceLabel: null,
      sourceUrl: null,
    });
  });
});
