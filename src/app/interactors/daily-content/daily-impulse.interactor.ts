import { inject, Injectable } from '@angular/core';

import { ContentCatalogSync } from '@app/data/content/content-catalog-sync';
import { ContentItemDao } from '@app/data/daos/content-item.dao';
import type { ContentItemRecord } from '@app/data/entities/content-item.record';
import { DailyImpulseStore } from '@app/data/stores/daily-impulse.store';

import type { ContentItemView } from './content-item.vm';
import { selectDailyImpulse } from './select-daily-impulse';

/**
 * Orchestrates the Today page's featured content item: today's stable pick if one was already
 * made, otherwise a fresh pick from today's eligible items, written back to the store so it stays
 * stable for the rest of the day.
 */
@Injectable({ providedIn: 'root' })
export class DailyImpulseInteractor {
  private readonly contentItems = inject(ContentItemDao);
  private readonly store = inject(DailyImpulseStore);
  private readonly catalogSync = inject(ContentCatalogSync);

  async featuredItem(today: string): Promise<ContentItemView | null> {
    await this.catalogSync.ensureSynced();
    const stable = this.store.pick();
    if (stable !== null && stable.day === today) {
      const record = await this.contentItems.findById(stable.itemId);
      return record === null ? null : toView(record);
    }

    const eligible = await this.contentItems.listEligibleForDay(today);
    const picked = selectDailyImpulse({ eligible, recentIds: this.store.recentIds(), today });

    if (picked !== null) {
      this.store.setPick(today, picked.id);
    }

    return picked === null ? null : toView(picked);
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
