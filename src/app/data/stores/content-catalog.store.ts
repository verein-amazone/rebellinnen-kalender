import { Injectable } from '@angular/core';

import { scopedStorageName } from '@app/cross-cutting/infrastructure/deployment-scope';

import { CatalogVersionStore } from './catalog-version.store';

const STORAGE_KEY = scopedStorageName('rk.contentCatalog');

/**
 * The version of `public/content/catalog.json` last reconciled into `content_items` by
 * `ContentCatalogSync` - see `CatalogVersionStore`.
 */
@Injectable({ providedIn: 'root' })
export class ContentCatalogStore extends CatalogVersionStore {
  protected override get storageKey(): string {
    return STORAGE_KEY;
  }
}
