import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ContentItemsInteractor } from '@app/interactors/daily-content/content-items.interactor';

/**
 * Placeholder content home. Also a debug entry point (#1): every curated item, linked to its
 * detail page, to click through the seeded catalog while Anlaufstellen and My Collection are
 * still unbuilt.
 */
@Component({
  selector: 'app-content-overview',
  // Component hosts are unknown elements and therefore inline by default.
  host: { class: 'block' },
  imports: [RouterLink],
  templateUrl: './overview.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContentOverviewPage {
  private readonly contentItems = inject(ContentItemsInteractor);

  private readonly data = resource({
    loader: () => this.contentItems.listAll(),
  });

  protected readonly items = computed(() => this.data.value() ?? []);
}
