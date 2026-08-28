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

import { BookmarkChanges } from '@app/cross-cutting/infrastructure/bookmark-changes';
import type {
  ContentItemKind,
  ContentItemView,
} from '@app/interactors/daily-content/content-item.vm';
import { BookmarksInteractor } from '@app/interactors/saved-content/bookmarks.interactor';
import { SupportServicesInteractor } from '@app/interactors/support-services/support-services.interactor';
import {
  ContentKindFilterBlock,
  type ContentKindFilterOption,
} from '@app/view/blocks/content-kind-filter/content-kind-filter.block';
import { SupportServiceCardBlock } from '@app/view/blocks/support-service-card/support-service-card.block';
import { SupportServiceRegionFilterBlock } from '@app/view/blocks/support-service-region-filter/support-service-region-filter.block';

type ContentArea = 'services' | 'collection';

function isContentArea(value: string | null | undefined): value is ContentArea {
  return value === 'services' || value === 'collection';
}

function isContentItemKind(value: string): value is ContentItemKind {
  return value === 'wissensimpulse' || value === 'rebellin';
}

const COLLECTION_KIND_LABELS: readonly { readonly id: ContentItemKind; readonly label: string }[] =
  [
    { id: 'wissensimpulse', label: 'Wissen & Impulse' },
    { id: 'rebellin', label: 'Rebell*in' },
  ];

/**
 * The Content home (#24): a switch between Meine Sammlung (My Collection, #23) - every bookmarked
 * item, filterable by content type, reactive to bookmark toggles made elsewhere (the detail view)
 * via `BookmarkChanges` - and Anlaufstellen (support services).
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
    ContentKindFilterBlock,
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

  /**
   * The selected area is route state (`?area=…`), the same way the calendar overview keeps its
   * Woche/Monat view: a reload, the browser's back button and the detail view's `returnTo` (see
   * `collectionReturnTo` below) all land on the tab the user left. Switching replaces the URL
   * rather than pushing it - a tab switch is not a place to come back to.
   *
   * „Meine Sammlung“ is the default: what the user saved themselves is the reason they come back
   * to this screen, while Anlaufstellen is a reference list that is looked up when it is needed.
   */
  readonly area = input<string>();
  protected readonly activeArea = computed<ContentArea>(() => {
    const area = this.area();
    return isContentArea(area) ? area : 'collection';
  });

  /**
   * Which content types are switched *off*, mirroring the calendar's source filter: an exclusion
   * set means every type is shown by default, and a new content type shows up without anyone
   * having to remember to add it to a list of selected ones.
   */
  protected readonly hiddenKinds = signal<ReadonlySet<ContentItemKind>>(
    new Set(
      (this.route.snapshot.queryParamMap.get('hidden') ?? '')
        .split(',')
        .filter((kind): kind is ContentItemKind => isContentItemKind(kind)),
    ),
  );

  /** The `returnTo` a Meine Sammlung item's link carries into the detail view - see above. */
  protected readonly collectionReturnTo = computed(() => {
    const hidden = [...this.hiddenKinds()].join(',');
    return hidden === '' ? '/content?area=collection' : `/content?area=collection&hidden=${hidden}`;
  });

  private readonly savedData = resource({
    params: () => ({ version: this.bookmarkChanges.version() }),
    loader: () => this.bookmarks.listSavedItems(),
  });
  protected readonly savedItems = computed(() => this.savedData.value() ?? []);
  protected readonly hasSavedItems = computed(() => this.savedItems().length > 0);

  protected readonly kindFilters = computed<readonly ContentKindFilterOption[]>(() => {
    const items = this.savedItems();

    return COLLECTION_KIND_LABELS.map((kind) => ({
      ...kind,
      count: items.filter((item) => item.kind === kind.id).length,
    }));
  });

  protected readonly filteredSavedItems = computed<readonly ContentItemView[]>(() => {
    const hidden = this.hiddenKinds();
    return this.savedItems().filter((item) => !hidden.has(item.kind));
  });

  /** The collection is not empty, the filter is - which needs saying, or the screen reads as loss. */
  protected readonly allKindsHidden = computed(() =>
    COLLECTION_KIND_LABELS.every((kind) => this.hiddenKinds().has(kind.id)),
  );

  protected toggleKind(kind: ContentItemKind): void {
    this.hiddenKinds.update((hidden) => {
      const next = new Set(hidden);
      if (!next.delete(kind)) {
        next.add(kind);
      }
      return next;
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
