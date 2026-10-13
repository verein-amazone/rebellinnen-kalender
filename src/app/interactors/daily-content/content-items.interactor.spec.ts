import { TestBed } from '@angular/core/testing';

import { ContentItemDao } from '@app/data/daos/content-item.dao';
import { ContentCatalogSync } from '@app/data/content/content-catalog-sync';
import type { ContentItemRecord } from '@app/data/entities/content-item.record';
import {
  ImageCatalogGateway,
  type ImageCatalogEntry,
} from '@app/data/gateways/image-catalog.gateway';

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

class FakeImageCatalogGateway {
  entries: ImageCatalogEntry[] = [];

  find(id: string): Promise<ImageCatalogEntry | null> {
    return Promise.resolve(this.entries.find((entry) => entry.id === id) ?? null);
  }
}

describe('ContentItemsInteractor', () => {
  let dao: FakeContentItemDao;
  let sync: FakeContentCatalogSync;
  let images: FakeImageCatalogGateway;
  let interactor: ContentItemsInteractor;

  beforeEach(() => {
    dao = new FakeContentItemDao();
    sync = new FakeContentCatalogSync();
    images = new FakeImageCatalogGateway();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: ContentItemDao, useValue: dao },
        { provide: ContentCatalogSync, useValue: sync },
        { provide: ImageCatalogGateway, useValue: images },
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
      heroImageId: null,
      sourceLabel: null,
      sourceUrl: null,
      relatedSources: [],
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
        imageAlt: null,
        imageAttribution: null,
        sourceLabel: null,
        sourceUrl: null,
        relatedSources: [],
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
      heroImageId: null,
      sourceLabel: null,
      sourceUrl: null,
      relatedSources: [],
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
      imageAlt: null,
      imageAttribution: null,
      sourceLabel: null,
      sourceUrl: null,
      relatedSources: [],
    });
  });

  it('shows the picture from the image catalog, described and credited from its entry', async () => {
    dao.items.set('reb-09', {
      id: 'reb-09',
      kind: 'rebellin',
      title: 'Ada Lovelace',
      teaser: 'Teaser',
      bodyMarkdown: 'Text',
      heroImageId: 'ada-lovelace',
      sourceLabel: null,
      sourceUrl: null,
      relatedSources: [],
      validFrom: null,
      validTo: null,
      eligibleForDaily: true,
    });
    images.entries = [
      {
        id: 'ada-lovelace',
        path: '/content/images/ada-lovelace.webp',
        title: 'Ada Lovelace',
        alt: 'Gemaltes Porträt von Ada Lovelace',
        creator: 'Alfred Edward Chalon',
        license: 'Public Domain',
        licenseUrl: null,
        changes: ['resized'],
      },
    ];

    await expect(interactor.findById('reb-09')).resolves.toMatchObject({
      imagePath: '/content/images/ada-lovelace.webp',
      imageAlt: 'Gemaltes Porträt von Ada Lovelace',
      imageAttribution: 'Alfred Edward Chalon, Public Domain',
    });
  });

  it('credits a picture by its licence alone when its creator is unknown', async () => {
    dao.items.set('reb-17', {
      id: 'reb-17',
      kind: 'rebellin',
      title: 'Samar Badawi',
      teaser: 'Teaser',
      bodyMarkdown: 'Text',
      heroImageId: 'samar-badawi',
      sourceLabel: null,
      sourceUrl: null,
      relatedSources: [],
      validFrom: null,
      validTo: null,
      eligibleForDaily: true,
    });
    images.entries = [
      {
        id: 'samar-badawi',
        path: '/content/images/samar-badawi.webp',
        title: 'Samar Badawi',
        alt: 'Foto von Samar Badawi',
        license: 'Public Domain',
        licenseUrl: null,
        changes: [],
      },
    ];

    await expect(interactor.findById('reb-17')).resolves.toMatchObject({
      imageAttribution: 'Public Domain',
    });
  });

  it('leaves an item without a picture when the image catalog does not know its image', async () => {
    dao.items.set('wi-01', {
      id: 'wi-01',
      kind: 'wissensimpulse',
      title: 'Titel',
      teaser: 'Teaser',
      bodyMarkdown: 'Text',
      heroImageId: 'unbekannt',
      sourceLabel: null,
      sourceUrl: null,
      relatedSources: [],
      validFrom: null,
      validTo: null,
      eligibleForDaily: true,
    });

    await expect(interactor.findById('wi-01')).resolves.toMatchObject({
      imagePath: null,
      imageAlt: null,
      imageAttribution: null,
    });
  });
});
