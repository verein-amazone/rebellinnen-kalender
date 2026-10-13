import { inject, Injectable } from '@angular/core';

import { SupportServiceDao, type SupportServiceSearchEntry } from '../daos/support-service.dao';
import type { SupportServiceRecord } from '../entities/support-service.record';
import {
  SupportServiceCatalogGateway,
  type SupportServiceCatalog,
  type SupportServiceCatalogItem,
} from '../gateways/support-service-catalog.gateway';
import { SQLITE_DATABASE } from '../gateways/sqlite-database';
import { foldForSearch } from '../search/search-text';
import { SupportServiceCatalogStore } from '../stores/support-service-catalog.store';
import { supportServiceRegionLabel } from './support-service-regions';

/**
 * Reconciles the Anlaufstellen catalog (`public/support-services/catalog.json`) into
 * `support_services` and its search index, the same way `ContentCatalogSync` does for the content:
 * the catalog ships as a versioned JSON asset, only a version change - or a database that lost its
 * rows - triggers the write, and once caught up the rest of the session skips even the fetch.
 *
 * Called lazily from `SupportServicesInteractor`, never at boot.
 */
@Injectable({ providedIn: 'root' })
export class SupportServiceCatalogSync {
  private readonly database = inject(SQLITE_DATABASE);
  private readonly gateway = inject(SupportServiceCatalogGateway);
  private readonly supportServices = inject(SupportServiceDao);
  private readonly store = inject(SupportServiceCatalogStore);

  /** Settled once this session is caught up - see `ContentCatalogSync.caughtUp`. */
  private caughtUp: Promise<void> | null = null;

  ensureSynced(): Promise<void> {
    this.caughtUp ??= this.sync().then(
      (synced) => {
        if (!synced) {
          this.caughtUp = null;
        }
      },
      (error: unknown) => {
        this.caughtUp = null;
        throw error;
      },
    );
    return this.caughtUp;
  }

  /** `false` when there was no catalog to sync against. */
  private async sync(): Promise<boolean> {
    const catalog = await this.gateway.fetchCatalog();
    if (catalog === null) {
      return false;
    }

    if (catalog.version === this.store.syncedVersion() && (await this.isComplete(catalog))) {
      return true;
    }

    const records = catalog.items.map(toRecord);
    await this.database.transaction((tx) =>
      this.supportServices.replaceAll(records, records.map(toSearchEntry), tx),
    );
    this.store.setSyncedVersion(catalog.version);
    return true;
  }

  /**
   * The version lives in `localStorage` and the rows in SQLite, and the two can disagree - see
   * `ContentCatalogSync.hasStoredItems`. A row count and an index count that both match the catalog
   * are the caught-up case.
   */
  private async isComplete(catalog: SupportServiceCatalog): Promise<boolean> {
    const expected = catalog.items.length;
    return (
      (await this.supportServices.count()) === expected &&
      (await this.supportServices.countIndexed()) === expected
    );
  }
}

function toRecord(item: SupportServiceCatalogItem, position: number): SupportServiceRecord {
  return {
    id: item.id,
    region: item.region,
    name: item.name,
    teaser: item.teaser,
    icon: item.icon,
    actions: item.actions.map((action) => ({
      type: action.type,
      label: action.label,
      uri: action.uri,
      displayValue: action.displayValue ?? null,
    })),
    position,
  };
}

/**
 * The region goes into the index by its name, so „Tirol“ or „Online“ finds the entries filed under
 * it. The contact details carry the button labels and the shown numbers, so `147` finds Rat auf
 * Draht - never a raw `tel:` or `https:` value.
 */
function toSearchEntry(record: SupportServiceRecord): SupportServiceSearchEntry {
  return {
    supportServiceId: record.id,
    name: foldForSearch(record.name),
    teaser: foldForSearch(record.teaser),
    region: foldForSearch(supportServiceRegionLabel(record.region)),
    contacts: foldForSearch(
      record.actions.map((action) => `${action.label} ${action.displayValue ?? ''}`).join(' '),
    ),
  };
}
