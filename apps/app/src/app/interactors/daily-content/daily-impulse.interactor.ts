import { DestroyRef, inject, Injectable } from '@angular/core';

import { AppLifecycle } from '@app/cross-cutting/infrastructure/app-lifecycle';
import { ContentCatalogSync } from '@app/data/content/content-catalog-sync';
import { ContentItemDao } from '@app/data/daos/content-item.dao';
import { ImageCatalogGateway } from '@app/data/gateways/image-catalog.gateway';
import { DailyImpulseStore } from '@app/data/stores/daily-impulse.store';
import { ImpulsePreferencesStore } from '@app/data/stores/impulse-preferences.store';

import type { ContentItemView } from './content-item.vm';
import { toContentItemView } from './content-item-view';
import { isWithinWindow } from './content-window';
import { selectDailyImpulse } from './select-daily-impulse';

/**
 * Orchestrates the Today page's featured content item: today's stable pick if one was already
 * made, otherwise a fresh pick from today's eligible items, written back to the store so it stays
 * stable for the rest of the day. The fresh pick is steered away from the kind of the impulse
 * featured before it.
 */
@Injectable({ providedIn: 'root' })
export class DailyImpulseInteractor {
  private readonly contentItems = inject(ContentItemDao);
  private readonly store = inject(DailyImpulseStore);
  private readonly catalogSync = inject(ContentCatalogSync);
  private readonly preferences = inject(ImpulsePreferencesStore);
  private readonly images = inject(ImageCatalogGateway);

  constructor() {
    // A return from the background is an opening of the app, so „Bei jedem Öffnen“ may greet again.
    // Registered here rather than in the Today block, so an opening counts even when the app comes
    // back on another tab and Today is only visited afterwards.
    const stop = inject(AppLifecycle).onResume(() => this.store.startSession());
    inject(DestroyRef).onDestroy(stop);
  }

  async featuredItem(today: string): Promise<ContentItemView | null> {
    await this.catalogSync.ensureSynced();
    const stable = this.store.pick();
    if (stable !== null && stable.day === today) {
      const record = await this.contentItems.findById(stable.itemId);
      return record === null ? null : toContentItemView(record, this.images);
    }

    const eligible = (await this.contentItems.listEligibleForDaily()).filter((item) =>
      isWithinWindow(item, today),
    );
    // The last impulse featured, however many days ago: it is the one the user saw before today's.
    const previous = stable === null ? null : await this.contentItems.findById(stable.itemId);
    const picked = selectDailyImpulse({
      eligible,
      recentIds: this.store.recentIds(),
      previous,
      today,
    });

    if (picked !== null) {
      this.store.setPick(today, picked.id);
    }

    return picked === null ? null : toContentItemView(picked, this.images);
  }

  /**
   * Whether the impulse should greet with its wave now, per the user's Tagesimpuls preference: once
   * per opening of the app, once per day, or never. Reads signals only, so an effect that calls it
   * runs again when the app is reopened or the day changes.
   */
  shouldGreet(day: string): boolean {
    switch (this.preferences.preferences().greeting) {
      case 'every-open':
        return !this.store.greetedThisSession();
      case 'daily':
        return !this.store.hasSeen(day);
      case 'off':
        return false;
    }
  }

  /** Whether the impulse may greet at all - a shake asks for it again, but not when it is off. */
  greetingEnabled(): boolean {
    return this.preferences.preferences().greeting !== 'off';
  }

  /** Records that the impulse has just greeted, for both the per-opening and the per-day rule. */
  markGreeted(day: string): void {
    this.store.markGreetedThisSession();
    this.store.markSeen(day);
  }

  /** Which item is featured today, if a pick was already made - for the debug catalog. */
  featuredItemId(today: string): string | null {
    const pick = this.store.pick();
    return pick !== null && pick.day === today ? pick.itemId : null;
  }

  /**
   * Features a specific item today, replacing whatever was picked. Development tooling: it is how a
   * content item can be looked at on Today without waiting for the selector to choose it.
   */
  featureItem(today: string, itemId: string): void {
    this.store.overridePick(today, itemId);
  }
}
