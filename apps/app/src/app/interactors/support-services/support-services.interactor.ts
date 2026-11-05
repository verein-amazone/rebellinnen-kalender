import { inject, Injectable } from '@angular/core';

import { SupportServiceDao } from '@app/data/daos/support-service.dao';
import type {
  SupportServiceActionRecord,
  SupportServiceRecord,
} from '@app/data/entities/support-service.record';
import { toFtsMatch } from '@app/data/search/search-text';
import { SupportServiceCatalogSync } from '@app/data/support-services/support-service-catalog-sync';
import { SUPPORT_SERVICE_REGIONS } from '@app/data/support-services/support-service-regions';

import type {
  SupportServiceActionView,
  SupportServiceRegion,
  SupportServiceView,
} from './support-service.vm';

/**
 * Region ids in the recommended display order (design handover #24) - the catalog's own region
 * list. A region only ever appears as a filter chip when the catalog actually has an entry for it
 * (see `listRegions`).
 */
export const REGION_ORDER = SUPPORT_SERVICE_REGIONS;

/**
 * The Anlaufstellen screen's data source (#24): every curated support-service entry, the set of
 * region filter chips they group into, and the search across all of them.
 */
@Injectable({ providedIn: 'root' })
export class SupportServicesInteractor {
  private readonly catalogSync = inject(SupportServiceCatalogSync);
  private readonly supportServices = inject(SupportServiceDao);

  async listAll(): Promise<SupportServiceView[]> {
    await this.catalogSync.ensureSynced();
    return (await this.supportServices.listAll()).map(toView);
  }

  /**
   * The entries a content item points to, in the order the item lists them. An id the catalog no
   * longer knows is left out rather than failing the item: `content-catalog.content.spec.ts` keeps
   * shipped ids valid, so only a stale database could still hold one.
   */
  async listByIds(ids: readonly string[]): Promise<SupportServiceView[]> {
    if (ids.length === 0) {
      return [];
    }

    const byId = new Map((await this.listAll()).map((service) => [service.id, service]));
    return ids.flatMap((id) => byId.get(id) ?? []);
  }

  /** Only regions with at least one approved entry, in the recommended display order. */
  async listRegions(): Promise<SupportServiceRegion[]> {
    await this.catalogSync.ensureSynced();
    const presentRegionIds = new Set(
      (await this.supportServices.listAll()).map((service) => service.region),
    );
    return REGION_ORDER.filter((region) => presentRegionIds.has(region.id));
  }

  /**
   * The entries matching what the user typed, across every region, best match first - or `null`
   * when the query has no term long enough to search for (see `toFtsMatch`), so the screen keeps
   * showing the unfiltered list.
   */
  async search(query: string): Promise<SupportServiceView[] | null> {
    const match = toFtsMatch(query);
    if (match === null) {
      return null;
    }

    await this.catalogSync.ensureSynced();
    return (await this.supportServices.search(match)).map(toView);
  }
}

function toView(item: SupportServiceRecord): SupportServiceView {
  return {
    id: item.id,
    region: item.region,
    name: item.name,
    teaser: item.teaser,
    icon: item.icon,
    actions: item.actions.map(toActionView),
  };
}

function toActionView(action: SupportServiceActionRecord): SupportServiceActionView {
  return {
    type: action.type,
    label: action.label,
    uri: action.uri,
    displayValue: action.displayValue,
  };
}
