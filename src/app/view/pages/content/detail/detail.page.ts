import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
} from '@angular/core';
import {
  LucideBookmark,
  LucideBookmarkCheck,
  LucideExternalLink,
  LucideSparkles,
  LucideUsers,
} from '@lucide/angular';
import { Router } from '@angular/router';

import type {
  ContentItemView,
  RelatedSourceView,
} from '@app/interactors/daily-content/content-item.vm';
import { ContentItemsInteractor } from '@app/interactors/daily-content/content-items.interactor';
import { BookmarksInteractor } from '@app/interactors/saved-content/bookmarks.interactor';
import { MarkdownContentComponent } from '@app/view/components/markdown-content/markdown-content';
import { SheetService } from '@app/view/components/sheet/sheet.service';
import {
  ConfirmationDialog,
  type ConfirmationDialogData,
} from '@app/view/dialogs/confirmation/confirmation.dialog';
import { FocusedScreenScaffold } from '@app/view/scaffolds/focused-screen/focused-screen.scaffold';

/** One related-source link, with its publisher/domain derived for display (#22). */
export interface RelatedSourceRow {
  readonly title: string;
  readonly url: string;
  readonly publisher: string;
}

/**
 * The curated content detail screen: content-type label, title, image, complete body, a "More on
 * this topic" related-sources section, and a bookmark toggle for one "Wissen & Impulse" piece or
 * Rebell*in (#1, #22).
 *
 * The bookmark toggle is the only way in or out of „Meine Sammlung“. Removing asks first and then
 * takes the user to the collection, so the result of the removal is visible where it happened.
 */
@Component({
  selector: 'app-content-detail',
  // Component hosts are unknown elements and therefore inline by default.
  host: { class: 'block' },
  imports: [
    FocusedScreenScaffold,
    MarkdownContentComponent,
    LucideBookmark,
    LucideBookmarkCheck,
    LucideExternalLink,
    LucideSparkles,
    LucideUsers,
  ],
  templateUrl: './detail.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContentDetailPage {
  private readonly contentItems = inject(ContentItemsInteractor);
  private readonly bookmarks = inject(BookmarksInteractor);
  private readonly sheets = inject(SheetService);
  private readonly router = inject(Router);

  /** Where a confirmed removal lands: the collection the item just left. */
  private static readonly COLLECTION_URL = '/content?area=collection';

  readonly id = input.required<string>();
  /**
   * Optional `?returnTo=` query param overriding where the back action goes - the same item is
   * reachable from Today, from „Meine Sammlung“ and from the debug catalog, so each link says
   * where leaving should land. Passed straight to the scaffold, which owns dismissal. Bound
   * automatically by the router's component input binding, same as `id`.
   */
  readonly returnTo = input<string | null>(null);

  private readonly data = resource({
    params: () => this.id(),
    loader: async ({ params: id }) => {
      const item = await this.contentItems.findById(id);
      const bookmarked = item === null ? false : await this.bookmarks.isBookmarked(item.id);
      return { item, bookmarked };
    },
  });

  protected readonly item = computed<ContentItemView | null>(() => this.data.value()?.item ?? null);
  protected readonly bookmarked = computed(() => this.data.value()?.bookmarked ?? false);

  protected readonly heading = computed(() => this.item()?.title ?? 'Inhalt');

  protected readonly typeLabel = computed(() =>
    this.item()?.kind === 'rebellin' ? 'Rebell*in' : 'Wissen & Impulse',
  );

  protected readonly relatedSources = computed<readonly RelatedSourceRow[]>(() =>
    (this.item()?.relatedSources ?? []).map(toRelatedSourceRow),
  );

  protected readonly bookmarkActionLabel = computed(() =>
    this.bookmarked() ? 'Aus „Meine Sammlung“ entfernen' : 'Zu „Meine Sammlung“ hinzufügen',
  );

  protected async toggleBookmark(): Promise<void> {
    const current = this.item();
    if (current === null) {
      return;
    }

    // Saving is cheap and instantly reversible, so it just happens. Removing is the one that is
    // easy to regret - a saved item is hard to find again - so it asks first.
    if (this.bookmarked()) {
      this.confirmUnsave(current);
      return;
    }

    await this.bookmarks.toggle(current.id);
    this.data.update((value) => (value === undefined ? value : { ...value, bookmarked: true }));
  }

  private confirmUnsave(item: ContentItemView): void {
    const data: ConfirmationDialogData = {
      message: `„${item.title}“ wird aus deiner Sammlung entfernt.`,
      confirmLabel: 'Entfernen',
      destructive: true,
    };

    this.sheets
      .open<boolean, ConfirmationDialogData>(ConfirmationDialog, {
        heading: 'Aus Sammlung entfernen?',
        data,
      })
      .closed.subscribe(async (confirmed) => {
        // Declining leaves everything as it was; the sheet returns focus to the toggle itself.
        if (confirmed !== true) {
          return;
        }

        await this.bookmarks.toggle(item.id);
        await this.router.navigateByUrl(ContentDetailPage.COLLECTION_URL, { replaceUrl: true });
      });
  }
}

/** Derives a human-readable publisher/domain label from a related source's URL, e.g. `example.org`. */
function toRelatedSourceRow(source: RelatedSourceView): RelatedSourceRow {
  return { ...source, publisher: publisherOf(source.url) };
}

function publisherOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
