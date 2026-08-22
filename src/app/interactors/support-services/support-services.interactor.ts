import { inject, Injectable } from '@angular/core';

import { SupportServiceCatalogGateway } from '@app/data/gateways/support-service-catalog.gateway';
import type {
  SupportServiceCatalogAction,
  SupportServiceCatalogItem,
} from '@app/data/gateways/support-service-catalog.gateway';

import type {
  SupportServiceActionView,
  SupportServiceRegion,
  SupportServiceView,
} from './support-service.vm';

/**
 * Region ids in the recommended display order (design handover #24): "Online & Telefon" first,
 * then Vorarlberg, Tirol, Salzburg, then the remaining federal states. A region only ever appears
 * as a filter chip when the catalog actually has an entry for it (see `listRegions`).
 */
const REGION_ORDER: readonly { readonly id: string; readonly label: string }[] = [
  { id: 'online', label: 'Online & Telefon' },
  { id: 'vorarlberg', label: 'Vorarlberg' },
  { id: 'tirol', label: 'Tirol' },
  { id: 'salzburg', label: 'Salzburg' },
  { id: 'kaernten', label: 'Kärnten' },
  { id: 'steiermark', label: 'Steiermark' },
  { id: 'oberoesterreich', label: 'Oberösterreich' },
  { id: 'niederoesterreich', label: 'Niederösterreich' },
  { id: 'wien', label: 'Wien' },
  { id: 'burgenland', label: 'Burgenland' },
];

/**
 * The Anlaufstellen screen's data source (#24): every curated support-service entry and the set
 * of region filter chips they group into.
 */
@Injectable({ providedIn: 'root' })
export class SupportServicesInteractor {
  private readonly catalog = inject(SupportServiceCatalogGateway);

  async listAll(): Promise<SupportServiceView[]> {
    return (await this.catalog.fetchCatalog()).map(toView);
  }

  /** Only regions with at least one approved entry, in the recommended display order. */
  async listRegions(): Promise<SupportServiceRegion[]> {
    const items = await this.catalog.fetchCatalog();
    const presentRegionIds = new Set(items.map((item) => item.region));
    return REGION_ORDER.filter((region) => presentRegionIds.has(region.id));
  }
}

function toView(item: SupportServiceCatalogItem): SupportServiceView {
  return {
    id: item.id,
    region: item.region,
    name: item.name,
    teaser: item.teaser,
    crisis: item.crisis ?? false,
    icon: item.icon,
    color: item.color,
    logoPath: item.logoPath ?? null,
    actions: item.actions.map(toActionView),
  };
}

function toActionView(action: SupportServiceCatalogAction): SupportServiceActionView {
  return {
    type: action.type,
    label: action.label,
    uri: action.uri,
    displayValue: action.displayValue ?? null,
  };
}
