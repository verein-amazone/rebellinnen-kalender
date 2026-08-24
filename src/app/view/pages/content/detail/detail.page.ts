import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  LucideBookmark,
  LucideBookmarkCheck,
  LucideExternalLink,
  LucideSparkles,
  LucideUsers,
} from '@lucide/angular';

import { estimateReadingTime } from '@app/cross-cutting/helpers/reading-time';
import type {
  ContentItemView,
  RelatedSourceView,
} from '@app/interactors/daily-content/content-item.vm';
import { ContentItemsInteractor } from '@app/interactors/daily-content/content-items.interactor';
import { BookmarksInteractor } from '@app/interactors/saved-content/bookmarks.interactor';
import { MarkdownContentComponent } from '@app/view/components/markdown-content/markdown-content';
import { FocusedScreenScaffold } from '@app/view/scaffolds/focused-screen/focused-screen.scaffold';

/** One related-source link, with its publisher/domain derived for display (#22). */
export interface RelatedSourceRow {
  readonly title: string;
  readonly url: string;
  readonly publisher: string;
}

/**
 * The curated content detail screen: content-type label, title, estimated reading time, image,
 * complete body, a "More on this topic" related-sources section, and a bookmark toggle for one
 * "Wissen & Impulse" piece or Rebell*in (#1, #22).
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
  private readonly router = inject(Router);

  readonly id = input.required<string>();
  /**
   * Optional `?returnTo=` query param overriding where the back action goes — e.g. the Today
   * page's featured card links here with `returnTo: '/today'` so leaving the detail view returns
   * there even if in-app history would otherwise land somewhere else (deep link, restored screen).
   * Bound automatically by the router's component input binding, same as `id`.
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

  protected readonly readingTime = computed(() => {
    const item = this.item();
    return item === null ? null : estimateReadingTime(item.bodyMarkdown);
  });

  protected readonly relatedSources = computed<readonly RelatedSourceRow[]>(() =>
    (this.item()?.relatedSources ?? []).map(toRelatedSourceRow),
  );

  protected readonly bookmarkActionLabel = computed(() =>
    this.bookmarked() ? 'Aus „Meine Sammlung“ entfernen' : 'Zu „Meine Sammlung“ hinzufügen',
  );

  /** Bound to the scaffold's `beforeDismiss`: a `returnTo` param always wins over history-back. */
  protected readonly beforeDismiss = (): boolean => {
    const returnTo = this.returnTo();
    if (returnTo === null) {
      return false;
    }

    void this.router.navigateByUrl(returnTo);
    return true;
  };

  protected async toggleBookmark(): Promise<void> {
    const current = this.item();
    if (current === null) {
      return;
    }

    await this.bookmarks.toggle(current.id);
    this.data.update((value) =>
      value === undefined ? value : { ...value, bookmarked: !value.bookmarked },
    );
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
