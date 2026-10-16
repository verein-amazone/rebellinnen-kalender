import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
  signal,
} from '@angular/core';
import {
  LucideBookmark,
  LucideBookmarkCheck,
  LucideBriefcase,
  LucideCamera,
  LucideExternalLink,
  LucideGhost,
  LucideMusic,
  LucideRotateCw,
  LucideSparkles,
  LucideSquarePlay,
  LucideUsers,
} from '@lucide/angular';
import { Router } from '@angular/router';

import {
  contentKindLabel,
  type ContentItemView,
  type RelatedSourceView,
} from '@app/interactors/daily-content/content-item.vm';
import { safeInAppUrl } from '@app/cross-cutting/helpers/in-app-url';
import { ContentItemsInteractor } from '@app/interactors/daily-content/content-items.interactor';
import { BookmarksInteractor } from '@app/interactors/saved-content/bookmarks.interactor';
import { HapticsInteractor } from '@app/interactors/feedback/haptics.interactor';
import { MarkdownContentComponent } from '@app/view/components/markdown-content/markdown-content';
import { SheetService } from '@app/view/components/sheet/sheet.service';
import {
  ConfirmationDialog,
  type ConfirmationDialogData,
} from '@app/view/dialogs/confirmation/confirmation.dialog';
import { FocusedScreenScaffold } from '@app/view/scaffolds/focused-screen/focused-screen.scaffold';
import { valueOr } from '@app/cross-cutting/helpers/resource-value';
import { RETURN_NAVIGATION } from '@app/view/scaffolds/main-navigation/scroll-memory';

import { linkPlatform, type LinkPlatform } from './link-platform';

/**
 * The curated content detail screen: content-type label, title, image, complete body, a "More on
 * this topic" related-sources section, and a bookmark toggle for one "Wissen & Impulse" piece or
 * Rebell*in (#1, #22).
 *
 * The bookmark toggle is the only way in or out of „Meine Sammlung“. Removing asks first and then
 * takes the user to the collection, so the result of the removal is visible where it happened.
 */
/** One "Mehr zum Thema" link, with the platform its icon is picked by. */
interface RelatedSourceRow extends RelatedSourceView {
  readonly platform: LinkPlatform;
}

@Component({
  selector: 'app-content-detail',
  // Component hosts are unknown elements and therefore inline by default.
  host: { class: 'block' },
  imports: [
    FocusedScreenScaffold,
    MarkdownContentComponent,
    LucideBookmark,
    LucideBookmarkCheck,
    LucideBriefcase,
    LucideCamera,
    LucideExternalLink,
    LucideGhost,
    LucideMusic,
    LucideRotateCw,
    LucideSparkles,
    LucideSquarePlay,
    LucideUsers,
  ],
  templateUrl: './detail.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContentDetailPage {
  private readonly contentItems = inject(ContentItemsInteractor);
  private readonly bookmarks = inject(BookmarksInteractor);
  private readonly haptics = inject(HapticsInteractor);
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

  /** `null` unless the caller passed a route of this app - see `safeInAppUrl`. */
  protected readonly safeReturnTo = computed(() => safeInAppUrl(this.returnTo()));

  private readonly data = resource({
    params: () => this.id(),
    loader: async ({ params: id }) => {
      const item = await this.contentItems.findById(id);
      const bookmarked = item === null ? false : await this.bookmarks.isBookmarked(item.id);
      return { item, bookmarked };
    },
  });

  protected readonly item = computed<ContentItemView | null>(
    () => valueOr(this.data, undefined)?.item ?? null,
  );
  protected readonly bookmarked = computed(
    () => valueOr(this.data, undefined)?.bookmarked ?? false,
  );

  protected readonly loadFailed = computed(() => this.data.error() !== undefined);

  /** Why the last change to „Meine Sammlung“ failed; cleared by the next one. */
  protected readonly bookmarkError = signal<string | null>(null);

  protected readonly heading = computed(() => this.item()?.title ?? 'Inhalt');

  protected readonly typeLabel = computed(() => {
    const item = this.item();
    return item === null ? '' : contentKindLabel(item.kind);
  });

  protected readonly relatedSources = computed<readonly RelatedSourceRow[]>(() =>
    (this.item()?.relatedSources ?? []).map((source) => ({
      ...source,
      platform: linkPlatform(source.url),
    })),
  );

  protected readonly bookmarkActionLabel = computed(() =>
    this.bookmarked() ? 'Aus „Meine Sammlung“ entfernen' : 'Zu „Meine Sammlung“ hinzufügen',
  );

  protected reload(): void {
    this.data.reload();
  }

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

    this.bookmarkError.set(null);
    try {
      await this.bookmarks.toggle(current.id);
    } catch (error) {
      console.warn('Der Inhalt konnte nicht gespeichert werden.', error);
      this.bookmarkError.set(
        'Der Inhalt konnte nicht in „Meine Sammlung“ gespeichert werden. Versuche es noch einmal.',
      );
      return;
    }
    void this.haptics.tick();
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

        this.bookmarkError.set(null);
        try {
          await this.bookmarks.toggle(item.id);
        } catch (error) {
          console.warn('Der Inhalt konnte nicht entfernt werden.', error);
          this.bookmarkError.set(
            'Der Inhalt konnte nicht aus „Meine Sammlung“ entfernt werden. Versuche es noch einmal.',
          );
          return;
        }
        await this.router.navigateByUrl(ContentDetailPage.COLLECTION_URL, RETURN_NAVIGATION);
      });
  }
}
