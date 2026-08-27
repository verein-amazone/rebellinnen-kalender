import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { ContentItemView } from '@app/interactors/daily-content/content-item.vm';
import { ContentItemsInteractor } from '@app/interactors/daily-content/content-items.interactor';
import { FocusedScreenScaffold } from '@app/view/scaffolds/focused-screen/focused-screen.scaffold';

/**
 * Developer-only listing of every curated content item, for clicking through the full catalog
 * without needing it featured on Today or bookmarked into My Collection. Not a user-facing
 * feature - kept under Settings → Entwicklung rather than the Content tab it used to live in.
 */
@Component({
  selector: 'app-settings-content-catalog',
  // Component hosts are unknown elements and therefore inline by default.
  host: { class: 'block' },
  imports: [FocusedScreenScaffold, RouterLink],
  templateUrl: './content-catalog.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContentCatalogPage {
  private readonly contentItems = inject(ContentItemsInteractor);

  private readonly data = resource({
    loader: () => this.contentItems.listAll(),
  });

  protected readonly items = computed<ContentItemView[]>(() => this.data.value() ?? []);
}
