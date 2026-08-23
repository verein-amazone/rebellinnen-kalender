import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideChevronRight, LucideSparkles, LucideUsers } from '@lucide/angular';

import { LocalDay } from '@app/cross-cutting/infrastructure/local-day';
import type { ContentItemView } from '@app/interactors/daily-content/content-item.vm';
import { DailyImpulseInteractor } from '@app/interactors/daily-content/daily-impulse.interactor';

/**
 * The Today page's featured content card (#1): today's stable "Wissen & Impulse" piece or
 * Rebell*in, the whole card a single link into the full item. Loaded and resolved to view state
 * here, the same split `TodayClosingBlock` uses, so `today.page.html` stays a thin shell.
 *
 * No bookmark toggle here — bookmarking lives on the detail view only, so this card has exactly
 * one action (open the item) rather than two competing tap targets.
 *
 * Falls back to the page's original "Heute gibt es noch keinen Tagesimpuls." copy when nothing is
 * eligible, rather than rendering a broken or misleading card.
 */
@Component({
  selector: 'app-today-impulse',
  host: { class: 'block' },
  imports: [RouterLink, LucideChevronRight, LucideSparkles, LucideUsers],
  templateUrl: './today-impulse.block.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodayImpulseBlock {
  private readonly daily = inject(DailyImpulseInteractor);
  private readonly currentDay = inject(LocalDay);

  protected readonly data = resource({
    params: () => ({ today: this.currentDay.day() }),
    loader: ({ params: { today } }) => this.daily.featuredItem(today),
  });

  protected readonly item = computed<ContentItemView | null>(() => this.data.value() ?? null);

  protected readonly typeLabel = computed(() =>
    this.item()?.kind === 'rebellin' ? 'Rebell*in' : 'Wissen & Impulse',
  );

  protected reload(): void {
    this.data.reload();
  }
}
