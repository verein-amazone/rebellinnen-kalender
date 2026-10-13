import { Injectable } from '@angular/core';

import { scopedStorageName } from '@app/cross-cutting/infrastructure/deployment-scope';

import { CatalogVersionStore } from './catalog-version.store';

const STORAGE_KEY = scopedStorageName('rk.supportServiceCatalog');

/**
 * The version of `public/support-services/catalog.json` last reconciled into `support_services` by
 * `SupportServiceCatalogSync` - see `CatalogVersionStore`.
 */
@Injectable({ providedIn: 'root' })
export class SupportServiceCatalogStore extends CatalogVersionStore {
  protected override get storageKey(): string {
    return STORAGE_KEY;
  }
}
