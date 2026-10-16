import { inject, Injectable } from '@angular/core';

import { ContentCatalogSync } from '@app/data/content/content-catalog-sync';
import { ContentItemDao } from '@app/data/daos/content-item.dao';
import { ImageCatalogGateway } from '@app/data/gateways/image-catalog.gateway';

import type { ContentItemView } from './content-item.vm';
import { toContentItemView } from './content-item-view';

/**
 * Looks up a single curated content item by id, for the content detail screen - the read path
 * views take instead of injecting `ContentItemDao` directly.
 */
@Injectable({ providedIn: 'root' })
export class ContentItemsInteractor {
  private readonly contentItems = inject(ContentItemDao);
  private readonly catalogSync = inject(ContentCatalogSync);
  private readonly images = inject(ImageCatalogGateway);

  async findById(id: string): Promise<ContentItemView | null> {
    await this.catalogSync.ensureSynced();
    const record = await this.contentItems.findById(id);
    return record === null ? null : toContentItemView(record, this.images);
  }

  /** Every content item, ordered by kind then id - for the debug content listing. */
  async listAll(): Promise<ContentItemView[]> {
    await this.catalogSync.ensureSynced();
    const records = await this.contentItems.listAll();
    return Promise.all(records.map((record) => toContentItemView(record, this.images)));
  }
}
