import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
  signal,
} from '@angular/core';
import { Tab, TabContent, TabList, TabPanel, Tabs } from '@angular/aria/tabs';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideCheck } from '@lucide/angular';

import { BookmarkChanges } from '@app/cross-cutting/infrastructure/bookmark-changes';
import { estimateReadingTime } from '@app/cross-cutting/helpers/reading-time';
import type { ContentItemView } from '@app/interactors/daily-content/content-item.vm';
import { BookmarksInteractor } from '@app/interactors/saved-content/bookmarks.interactor';
import { SupportServicesInteractor } from '@app/interactors/support-services/support-services.interactor';
import { SupportServiceCardBlock } from '@app/view/blocks/support-service-card/support-service-card.block';
import { SupportServiceRegionFilterBlock } from '@app/view/blocks/support-service-region-filter/support-service-region-filter.block';
import {
  ConfirmationDialog,
  type ConfirmationDialogData,
} from '@app/view/dialogs/confirmation/confirmation.dialog';
import { SheetService } from '@app/view/components/sheet/sheet.service';

type ContentArea = 'services' | 'collection';

function isContentArea(value: string | null | undefined): value is ContentArea {
  return value === 'services' || value === 'collection';
}

type CollectionFilter = 'all' | ContentItemView['kind'];

function isCollectionFilter(value: string | null | undefined): value is CollectionFilter {
  return value === 'all' || value === 'wissensimpulse' || value === 'rebellin';
}

const COLLECTION_FILTERS: readonly { readonly id: CollectionFilter; readonly label: string }[] = [
  { id: 'all', label: 'Alle' },
  { id: 'wissensimpulse', label: 'Wissen & Impulse' },
  { id: 'rebellin', label: 'Rebell*in' },
];

/** One saved item as the Meine Sammlung card needs it - its reading time precomputed once. */
interface SavedItemRow {
  readonly item: ContentItemView;
  readonly readingTime: string;
}

/**
 * The Content home (#24): a switch between Anlaufstellen (support services) and Meine Sammlung
 * (My Collection, #23) - every bookmarked item, filterable by content type, reactive to bookmark
 * toggles made elsewhere (the detail view) via `BookmarkChanges`.
 *
 * The area switch uses `@angular/aria/tabs` (`Tabs`/`TabList`/`Tab`/`TabPanel`) rather than a
 * hand-rolled `role="tab"` set - it's the APG tab pattern (arrow-key navigation, `aria-selected`,
 * `aria-controls` linking each tab to its panel, `inert` on the hidden panel) implemented and kept
 * current by Angular itself, ahead of custom ARIA in the project's a11y order of preference.
 */
@Component({
  selector: 'app-content-overview',
  // Component hosts are unknown elements and therefore inline by default.
  host: { class: 'block' },
  imports: [
    RouterLink,
    SupportServiceRegionFilterBlock,
    SupportServiceCardBlock,
    Tabs,
    TabList,
    Tab,
    TabPanel,
    TabContent,
    LucideCheck,
  ],
  templateUrl: './overview.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContentOverviewPage {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly bookmarks = inject(BookmarksInteractor);
  private readonly bookmarkChanges = inject(BookmarkChanges);
  private readonly supportServices = inject(SupportServicesInteractor);
  private readonly sheets = inject(SheetService);

  /**
   * The selected area is route state (`?area=…`), the same way the calendar overview keeps its
   * Woche/Monat view: a reload, the browser's back button and the detail view's `returnTo` (see
   * `collectionReturnTo` below) all land on the tab the user left. Switching replaces the URL
   * rather than pushing it - a tab switch is not a place to come back to.
   */
  readonly area = input<string>();
  protected readonly activeArea = computed<ContentArea>(() => {
    const area = this.area();
    return isContentArea(area) ? area : 'services';
  });

  protected readonly collectionFilters = COLLECTION_FILTERS;
  protected readonly collectionFilter = signal<CollectionFilter>(
    isCollectionFilter(this.route.snapshot.queryParamMap.get('filter'))
      ? (this.route.snapshot.queryParamMap.get('filter') as CollectionFilter)
      : 'all',
  );

  /** The `returnTo` a Meine Sammlung item's link carries into the detail view - see above. */
  protected readonly collectionReturnTo = computed(
    () => `/content?area=collection&filter=${this.collectionFilter()}`,
  );

  private readonly savedData = resource({
    params: () => ({ version: this.bookmarkChanges.version() }),
    loader: () => this.bookmarks.listSavedItems(),
  });
  protected readonly savedItems = computed(() => this.savedData.value() ?? []);
  protected readonly hasSavedItems = computed(() => this.savedItems().length > 0);

  protected readonly filterCounts = computed<Record<CollectionFilter, number>>(() => {
    const items = this.savedItems();
    return {
      all: items.length,
      wissensimpulse: items.filter((item) => item.kind === 'wissensimpulse').length,
      rebellin: items.filter((item) => item.kind === 'rebellin').length,
    };
  });

  protected readonly filteredSavedItems = computed<readonly SavedItemRow[]>(() => {
    const filter = this.collectionFilter();
    const items = this.savedItems().filter((item) => filter === 'all' || item.kind === filter);
    return items.map((item) => ({ item, readingTime: estimateReadingTime(item.bodyMarkdown) }));
  });

  protected selectCollectionFilter(filter: CollectionFilter): void {
    this.collectionFilter.set(filter);
  }

  /** Confirms before removing - a saved item is easy to lose track of, unlike bookmarking one. */
  protected confirmUnsave(item: ContentItemView): void {
    const data: ConfirmationDialogData = {
      message: `„${item.title}“ wird aus deiner Sammlung entfernt.`,
      confirmLabel: 'Entfernen',
    };

    this.sheets
      .open<boolean, ConfirmationDialogData>(ConfirmationDialog, {
        heading: 'Aus Sammlung entfernen?',
        data,
      })
      .closed.subscribe((confirmed) => {
        if (confirmed === true) {
          void this.bookmarks.toggle(item.id);
        }
      });
  }

  protected readonly servicesData = resource({
    loader: () => this.supportServices.listAll(),
  });
  protected readonly regionsData = resource({
    loader: () => this.supportServices.listRegions(),
  });
  protected readonly regions = computed(() => this.regionsData.value() ?? []);
  protected readonly servicesLoading = computed(
    () => this.regionsData.status() === 'loading' || this.servicesData.status() === 'loading',
  );
  protected readonly servicesError = computed(
    () => this.regionsData.error() !== undefined || this.servicesData.error() !== undefined,
  );

  private readonly selectedRegion = signal<string | null>(null);
  protected readonly effectiveRegion = computed(
    () => this.selectedRegion() ?? this.regions()[0]?.id ?? null,
  );
  /** `effectiveRegion` is only ever `null` before `regions()` has loaded, when the filter and list
   *  are hidden anyway - this gives the template a plain `string` to bind without an inline `??`. */
  protected readonly selectedRegionId = computed(() => this.effectiveRegion() ?? '');

  protected readonly filteredServices = computed(() => {
    const region = this.effectiveRegion();
    if (region === null) {
      return [];
    }

    return (this.servicesData.value() ?? []).filter((service) => service.region === region);
  });

  protected selectRegion(regionId: string): void {
    this.selectedRegion.set(regionId);
  }

  /** The tab list hands back the selected tab's `value`; anything else cannot come from the DOM. */
  protected onAreaChange(value: string | undefined): void {
    if (isContentArea(value)) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { area: value },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  protected reloadServices(): void {
    this.regionsData.reload();
    this.servicesData.reload();
  }
}
