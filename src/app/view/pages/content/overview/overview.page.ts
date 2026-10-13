import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  debounced,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  resource,
  signal,
  untracked,
  viewChild,
  type Resource,
} from '@angular/core';
import { Tab, TabContent, TabList, TabPanel, Tabs } from '@angular/aria/tabs';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideRotateCw, LucideSearch, LucideX } from '@lucide/angular';

import { BookmarkChanges } from '@app/cross-cutting/infrastructure/bookmark-changes';
import { HardwareBack } from '@app/cross-cutting/infrastructure/hardware-back';
import {
  CONTENT_KIND_LABELS,
  contentKindLabel,
  type ContentItemKind,
  type ContentItemView,
} from '@app/interactors/daily-content/content-item.vm';
import { BookmarksInteractor } from '@app/interactors/saved-content/bookmarks.interactor';
import { HapticsInteractor } from '@app/interactors/feedback/haptics.interactor';
import type { SupportServiceView } from '@app/interactors/support-services/support-service.vm';
import { SupportServicesInteractor } from '@app/interactors/support-services/support-services.interactor';
import {
  ContentKindFilterBlock,
  type ContentKindFilterOption,
} from '@app/view/blocks/content-kind-filter/content-kind-filter.block';
import { SupportServiceCardBlock } from '@app/view/blocks/support-service-card/support-service-card.block';
import { SupportServiceRegionFilterBlock } from '@app/view/blocks/support-service-region-filter/support-service-region-filter.block';
import { valueOr } from '@app/cross-cutting/helpers/resource-value';
import { InfoToggletip } from '@app/view/components/info-toggletip/info-toggletip';

type ContentArea = 'services' | 'collection';

function isContentArea(value: string | null | undefined): value is ContentArea {
  return value === 'services' || value === 'collection';
}

/** How long typing has to pause before the list follows - long enough to skip every keystroke. */
const SEARCH_DEBOUNCE_MS = 200;

/**
 * A search resource's latest result, kept while the next one loads: the list must not flash back to
 * the unfiltered state between two keystrokes' results. `null` means "no filter".
 */
function lastResult<T>(search: Resource<T[] | null | undefined>) {
  return linkedSignal<T[] | null | undefined, T[] | null>({
    source: () => (search.isLoading() ? undefined : valueOr(search, null)),
    computation: (next, previous) => (next === undefined ? (previous?.value ?? null) : next),
  });
}

function isContentItemKind(value: string): value is ContentItemKind {
  return value === 'wissensimpulse' || value === 'rebellin';
}

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
    NgTemplateOutlet,
    RouterLink,
    SupportServiceRegionFilterBlock,
    SupportServiceCardBlock,
    Tabs,
    TabList,
    Tab,
    TabPanel,
    TabContent,
    ContentKindFilterBlock,
    LucideRotateCw,
    LucideSearch,
    LucideX,
    InfoToggletip,
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
  private readonly haptics = inject(HapticsInteractor);
  private readonly hardwareBack = inject(HardwareBack);
  private readonly injector = inject(Injector);

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

  /**
   * The search, open or closed, and what is typed into it.
   *
   * The query is route state (`?q=…`) like the area, so the detail view's `returnTo` lands back on
   * the same results - but only its debounced value is written there and searched for. Both start
   * from the URL, so a return from the detail view reopens the search where it was.
   */
  readonly q = input<string>();
  protected readonly searchOpen = signal(this.route.snapshot.queryParamMap.has('q'));
  protected readonly searchText = signal(this.route.snapshot.queryParamMap.get('q') ?? '');
  private readonly debouncedText = debounced(this.searchText, SEARCH_DEBOUNCE_MS);
  /** What is searched for: empty while the search is closed. */
  protected readonly query = computed(() =>
    this.searchOpen() ? (valueOr(this.debouncedText, '') as string).trim() : '',
  );

  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private readonly searchButton = viewChild<ElementRef<HTMLButtonElement>>('searchButton');

  /** The search button's name and the field's label - the area it searches, in its own words. */
  protected readonly searchLabel = computed(() =>
    this.activeArea() === 'collection' ? 'In Meine Sammlung suchen' : 'In Anlaufstellen suchen',
  );

  /** The `returnTo` a Meine Sammlung item's link carries into the detail view - see above. */
  protected readonly collectionReturnTo = computed(() => {
    const params = new URLSearchParams({ area: 'collection' });
    const hidden = [...this.hiddenKinds()].join(',');
    if (hidden !== '') {
      params.set('hidden', hidden);
    }
    if (this.query() !== '') {
      params.set('q', this.query());
    }
    // `URLSearchParams` would encode the comma between hidden kinds; the route reads either form.
    return `/content?${params.toString().replace(/%2C/g, ',')}`;
  });

  private readonly savedData = resource({
    params: () => ({ version: this.bookmarkChanges.version() }),
    loader: () => this.bookmarks.listSavedItems(),
  });
  protected readonly savedItems = computed(() => valueOr(this.savedData, []));
  protected readonly hasSavedItems = computed(() => this.savedItems().length > 0);
  protected readonly kindLabel = contentKindLabel;

  protected readonly kindFilters = computed<readonly ContentKindFilterOption[]>(() => {
    const items = this.savedItems();

    return CONTENT_KIND_LABELS.map((kind) => ({
      ...kind,
      count: items.filter((item) => item.kind === kind.id).length,
    }));
  });

  private readonly savedSearch = resource({
    params: () => ({ query: this.query(), version: this.bookmarkChanges.version() }),
    loader: ({ params }) =>
      params.query === '' ? Promise.resolve(null) : this.bookmarks.searchSavedItems(params.query),
  });
  /** The saved items matching the query, best first - `null` while no query is being searched. */
  protected readonly savedMatches = lastResult(this.savedSearch);

  protected readonly filteredSavedItems = computed<readonly ContentItemView[]>(() => {
    const hidden = this.hiddenKinds();
    return (this.savedMatches() ?? this.savedItems()).filter((item) => !hidden.has(item.kind));
  });

  /** The collection is not empty, the filter is - which needs saying, or the screen reads as loss. */
  protected readonly allKindsHidden = computed(() =>
    CONTENT_KIND_LABELS.every((kind) => this.hiddenKinds().has(kind.id)),
  );

  protected toggleKind(kind: ContentItemKind): void {
    this.hiddenKinds.update((hidden) => {
      const next = new Set(hidden);
      if (!next.delete(kind)) {
        next.add(kind);
      }
      return next;
    });
    void this.haptics.selection();
  }

  protected readonly servicesData = resource({
    loader: () => this.supportServices.listAll(),
  });
  protected readonly regionsData = resource({
    loader: () => this.supportServices.listRegions(),
  });
  protected readonly regions = computed(() => valueOr(this.regionsData, []));
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

  private readonly servicesSearch = resource({
    params: () => ({ query: this.query() }),
    loader: ({ params }) =>
      params.query === '' ? Promise.resolve(null) : this.supportServices.search(params.query),
  });
  /** The entries matching the query across every region - `null` while none is searched. */
  protected readonly serviceMatches = lastResult<SupportServiceView>(this.servicesSearch);

  /**
   * What the search reports, once per settled result: a hint while the query is too short to
   * search, otherwise the number of hits in the visible area. Empty while nothing is searched.
   */
  protected readonly searchStatus = computed(() => {
    const query = this.query();
    if (query === '') {
      return '';
    }

    const matches =
      this.activeArea() === 'collection' ? this.savedMatches() : this.serviceMatches();
    if (matches === null) {
      return 'Mindestens 3 Zeichen eingeben';
    }

    const count =
      this.activeArea() === 'collection'
        ? this.filteredSavedItems().length
        : (this.serviceMatches()?.length ?? 0);
    if (count === 0) {
      return `Keine Treffer für „${query}“`;
    }
    return count === 1 ? '1 Treffer' : `${count} Treffer`;
  });

  /** A region's name for a search result's card, which no longer sits under its region's chip. */
  protected regionLabel(regionId: string): string {
    return this.regions().find((region) => region.id === regionId)?.label ?? regionId;
  }

  protected readonly filteredServices = computed(() => {
    const region = this.effectiveRegion();
    if (region === null) {
      return [];
    }

    return valueOr(this.servicesData, []).filter((service) => service.region === region);
  });

  protected selectRegion(regionId: string): void {
    // Tapping the region that is already selected changes nothing, so it is not felt either.
    if (regionId === this.effectiveRegion()) {
      return;
    }

    this.selectedRegion.set(regionId);
    void this.haptics.selection();
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

  constructor() {
    // Writes the searched query back into the URL - see `q`. Replaced, not pushed: a keystroke is
    // not a place to come back to.
    effect(() => {
      const query = this.query();
      if (query === (untracked(this.q) ?? '')) {
        return;
      }

      untracked(() => {
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { q: query === '' ? null : query },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      });
    });

    // Android's back button closes an open search before it leaves the screen. Registered only
    // while open, the same way the info toggletip does.
    effect((onCleanup) => {
      if (this.searchOpen()) {
        onCleanup(
          this.hardwareBack.register(() => {
            this.closeSearch();
            return true;
          }),
        );
      }
    });
  }

  /** Opens the field and puts the cursor into it - the tap was a request to type. */
  protected openSearch(): void {
    this.searchOpen.set(true);
    afterNextRender(() => this.searchInput()?.nativeElement.focus(), { injector: this.injector });
  }

  /**
   * Clears and closes the search, and hands focus back to the button that opened it, which takes
   * the field's place - focus must not fall back to the start of the page.
   */
  protected closeSearch(): void {
    this.searchOpen.set(false);
    this.searchText.set('');
    afterNextRender(() => this.searchButton()?.nativeElement.focus(), { injector: this.injector });
  }

  protected onSearchInput(event: Event): void {
    this.searchText.set((event.target as HTMLInputElement).value);
  }

  /** Enter on the phone keyboard's „Suchen“ key: the results are already there, so put it away. */
  protected dismissKeyboard(event: Event): void {
    (event.target as HTMLInputElement).blur();
  }

  protected reloadServices(): void {
    this.regionsData.reload();
    this.servicesData.reload();
  }
}
