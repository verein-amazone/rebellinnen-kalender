import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { Tab, TabContent, TabList, TabPanel, Tabs } from '@angular/aria/tabs';
import { RouterLink } from '@angular/router';

import { ContentItemsInteractor } from '@app/interactors/daily-content/content-items.interactor';
import { SupportServicesInteractor } from '@app/interactors/support-services/support-services.interactor';
import { SupportServiceCardBlock } from '@app/view/blocks/support-service-card/support-service-card.block';
import { SupportServiceRegionFilterBlock } from '@app/view/blocks/support-service-region-filter/support-service-region-filter.block';

type ContentArea = 'services' | 'collection';

function isContentArea(value: string | undefined): value is ContentArea {
  return value === 'services' || value === 'collection';
}

/**
 * The Content home (#24): a switch between Anlaufstellen (support services) and Meine Sammlung
 * (My Collection). Anlaufstellen is the default and only area this ticket builds; My Collection
 * stays a placeholder — #23 replaces it with the real screen — and keeps the previous debug entry
 * point into every curated item, since the detail route otherwise is only reachable through the
 * Today page's single daily impulse.
 *
 * The area switch uses `@angular/aria/tabs` (`Tabs`/`TabList`/`Tab`/`TabPanel`) rather than a
 * hand-rolled `role="tab"` set — it's the APG tab pattern (arrow-key navigation, `aria-selected`,
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
  ],
  templateUrl: './overview.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContentOverviewPage {
  private readonly contentItems = inject(ContentItemsInteractor);
  private readonly supportServices = inject(SupportServicesInteractor);

  protected readonly activeArea = signal<ContentArea>('services');

  private readonly contentData = resource({
    loader: () => this.contentItems.listAll(),
  });
  protected readonly items = computed(() => this.contentData.value() ?? []);

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
   *  are hidden anyway — this gives the template a plain `string` to bind without an inline `??`. */
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

  protected onAreaChange(value: string | undefined): void {
    if (isContentArea(value)) {
      this.activeArea.set(value);
    }
  }

  protected reloadServices(): void {
    this.regionsData.reload();
    this.servicesData.reload();
  }
}
