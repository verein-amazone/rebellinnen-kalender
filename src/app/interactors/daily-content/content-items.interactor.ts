import { inject, Injectable } from '@angular/core';

import { ContentCatalogSync } from '@app/data/content/content-catalog-sync';
import { ContentItemDao } from '@app/data/daos/content-item.dao';
import type { ContentItemRecord } from '@app/data/entities/content-item.record';

import type { ContentItemView } from './content-item.vm';

/**
 * Looks up a single curated content item by id, for the content detail screen — the read path
 * views take instead of injecting `ContentItemDao` directly.
 */
@Injectable({ providedIn: 'root' })
export class ContentItemsInteractor {
  private readonly contentItems = inject(ContentItemDao);
  private readonly catalogSync = inject(ContentCatalogSync);

  async findById(id: string): Promise<ContentItemView | null> {
    await this.catalogSync.ensureSynced();
    const record = await this.contentItems.findById(id);
    return record === null ? null : toView(record);
  }

  /** Every content item, ordered by kind then id — for the debug content listing. */
  async listAll(): Promise<ContentItemView[]> {
    await this.catalogSync.ensureSynced();
    return (await this.contentItems.listAll()).map(toView);
  }
}

function toView(record: ContentItemRecord): ContentItemView {
  return {
    id: record.id,
    kind: record.kind,
    title: record.title,
    teaser: record.teaser,
    bodyMarkdown: record.bodyMarkdown,
    imagePath: record.imagePath,
    imageAttribution: record.imageAttribution,
    sourceLabel: record.sourceLabel,
    sourceUrl: record.sourceUrl,
    relatedSources: record.relatedSources,
  };
}
