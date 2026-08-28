import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideCheck, LucideChevronRight } from '@lucide/angular';

import { LocalDay } from '@app/cross-cutting/infrastructure/local-day';
import type { ContentItemView } from '@app/interactors/daily-content/content-item.vm';
import { ContentItemsInteractor } from '@app/interactors/daily-content/content-items.interactor';
import { DailyImpulseInteractor } from '@app/interactors/daily-content/daily-impulse.interactor';
import { FocusedScreenScaffold } from '@app/view/scaffolds/focused-screen/focused-screen.scaffold';

/**
 * Developer-only listing of every curated content item, for clicking through the full catalog
 * without needing it featured on Today or bookmarked into My Collection. Not a user-facing
 * feature - kept under Settings → Entwicklung rather than the Content tab it used to live in.
 *
 * Each row also selects the item as today's Tagesimpuls, so any item can be seen rendered on Today
 * rather than only the one the selector happened to pick. Selecting is a radio group: exactly one
 * item is featured, and the featured one is marked by a check icon and `aria-checked`, never by
 * colour alone. Opening the item itself is a separate control in the same row - the row's tap
 * target must not do two different things.
 */
@Component({
  selector: 'app-settings-content-catalog',
  // Component hosts are unknown elements and therefore inline by default.
  host: { class: 'block' },
  imports: [FocusedScreenScaffold, RouterLink, LucideCheck, LucideChevronRight],
  templateUrl: './content-catalog.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContentCatalogPage {
  private readonly contentItems = inject(ContentItemsInteractor);
  private readonly daily = inject(DailyImpulseInteractor);
  private readonly currentDay = inject(LocalDay);

  private readonly data = resource({
    loader: () => this.contentItems.listAll(),
  });

  protected readonly items = computed<ContentItemView[]>(() => this.data.value() ?? []);

  /** A load in flight is not an empty catalog, and on this page the difference matters. */
  protected readonly loading = computed(() => this.data.status() === 'loading');

  /** Debug tooling: a failed load must say so instead of looking like an empty catalog. */
  protected readonly error = computed(() => {
    const failure = this.data.error();
    return failure === undefined ? null : String(failure);
  });

  /**
   * Mirrors the store rather than reading it on every change detection: the interactor's answer is
   * a plain read, not a signal, so the page keeps its own view-facing copy.
   */
  protected readonly featuredId = signal<string | null>(
    this.daily.featuredItemId(this.currentDay.day()),
  );

  protected featureItem(itemId: string): void {
    this.daily.featureItem(this.currentDay.day(), itemId);
    this.featuredId.set(itemId);
  }
}
