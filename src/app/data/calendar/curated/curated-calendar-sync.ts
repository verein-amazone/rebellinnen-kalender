import { inject, Injectable } from '@angular/core';

import { CalendarRepository, icsCalendarRowId } from '@app/data/calendar/calendar.repository';
import { normalizeIcsUrl } from '@app/data/calendar/ics/ics-url';
import { IcsSubscriptionDao } from '@app/data/daos/ics-subscription.dao';
import { CuratedCalendarsStore } from '@app/data/stores/curated-calendars.store';

const CATALOG_URL = '/curated-calendars/catalog.json';

/** One curated calendar source as it ships in the catalog asset. */
export interface CatalogEntry {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly url: string;
  readonly color: string;
  readonly emoji: string;
}

export interface Catalog {
  readonly version: number;
  readonly sources: readonly CatalogEntry[];
}

/**
 * Reconciles the curated calendar catalog (`public/curated-calendars/catalog.json`) into
 * `ics_subscriptions`, correlated by `curated_id` (#2).
 *
 * Unlike `ContentCatalogSync`, this never deletes or disables a source whose catalog entry later
 * disappears: a calendar source carries a live subscription and possible user customisation
 * (colour, emoji, enabled state), so removing it because a line dropped out of the JSON would be a
 * surprising, hard-to-reverse action for a no-accounts v0.1 app. It also never overwrites an
 * existing source's identity - the catalog's `color`/`emoji`/`name` are only ever applied once, the
 * first time a source is seeded.
 *
 * Called lazily - never from an app initializer - matching this repo's existing rule that the
 * database connection opens on first use, not at boot.
 */
@Injectable({ providedIn: 'root' })
export class CuratedCalendarSync {
  private readonly repository = inject(CalendarRepository);
  private readonly subscriptions = inject(IcsSubscriptionDao);
  private readonly store = inject(CuratedCalendarsStore);

  /**
   * Several callers (Today, the calendar views, the management screen, a retry) can call
   * `ensureSynced()` around the same time. Without serializing them, two concurrent calls can both
   * see the same not-yet-synced version, both find no existing row for a catalog entry and both
   * create one - the version is only marked synced once the whole reconciliation has committed.
   * Every concurrent caller therefore awaits the same in-flight reconciliation instead of starting
   * its own.
   */
  private inFlight: Promise<{
    catalog: Catalog | null;
    createdSubscriptionIds: readonly string[];
  }> | null = null;

  /**
   * Fetches the catalog and creates any missing curated sources. Returns the parsed catalog (even
   * when nothing needed reconciling - callers need its entries for descriptions) and the ids of
   * subscriptions created by this call, so the caller can trigger their first download.
   */
  async ensureSynced(): Promise<{
    catalog: Catalog | null;
    createdSubscriptionIds: readonly string[];
  }> {
    if (this.inFlight !== null) {
      return this.inFlight;
    }

    const sync = this.doSync().finally(() => {
      this.inFlight = null;
    });
    this.inFlight = sync;
    return sync;
  }

  private async doSync(): Promise<{
    catalog: Catalog | null;
    createdSubscriptionIds: readonly string[];
  }> {
    const catalog = await this.fetchCatalog();
    if (catalog === null) {
      return { catalog: null, createdSubscriptionIds: [] };
    }
    if (catalog.version === this.store.syncedVersion()) {
      return { catalog, createdSubscriptionIds: [] };
    }

    const createdSubscriptionIds = await this.reconcile(catalog.sources);
    this.store.setSyncedVersion(catalog.version);
    return { catalog, createdSubscriptionIds };
  }

  private async reconcile(entries: readonly CatalogEntry[]): Promise<readonly string[]> {
    const created: string[] = [];
    // Every calendar list sorts by `created_at`. Seeding the whole catalog inside one millisecond
    // would tie every row and let the random UUID tie-breaker decide the order, so each entry is
    // stamped one millisecond after the previous one and the catalog's order carries through.
    const seededAtMs = Date.now();

    for (const [index, entry] of entries.entries()) {
      const existing = await this.subscriptions.findByCuratedId(entry.id);
      if (existing !== null) {
        continue;
      }

      let normalizedUrl: string;
      try {
        normalizedUrl = normalizeIcsUrl(entry.url, { allowInsecure: false });
      } catch (error) {
        // A malformed catalog entry must never break the app; it stays missing until the catalog
        // is fixed and the version bumped again.
        console.warn(`Curated calendar "${entry.id}" has an invalid URL and was skipped.`, error);
        continue;
      }

      const subscriptionId = crypto.randomUUID();
      const nowUtc = new Date(seededAtMs + index).toISOString();

      await this.repository.createIcsSubscription(
        {
          id: subscriptionId,
          type: 'ics',
          name: entry.name,
          enabled: true,
          state: 'ok',
          createdAt: nowUtc,
          updatedAt: nowUtc,
        },
        {
          id: icsCalendarRowId(subscriptionId),
          sourceId: subscriptionId,
          name: entry.name,
          color: entry.color,
          emoji: entry.emoji,
          enabled: true,
          writable: false,
          externalId: null,
          nativeSourceId: null,
          nativeSourceName: null,
          createdAt: nowUtc,
          updatedAt: nowUtc,
        },
        {
          id: subscriptionId,
          url: normalizedUrl,
          allowInsecure: false,
          etag: null,
          lastModified: null,
          lastSuccessAt: null,
          lastCheckedAt: null,
          lastAttemptAt: null,
          lastError: null,
          activeRevisionId: null,
          rawIcs: null,
          createdAt: nowUtc,
          updatedAt: nowUtc,
          curatedId: entry.id,
        },
      );

      created.push(subscriptionId);
    }

    return created;
  }

  /** `null` on any failure - a missing/unreachable/malformed asset must never break the app. */
  private async fetchCatalog(): Promise<Catalog | null> {
    try {
      const response = await fetch(CATALOG_URL);
      if (!response.ok) {
        return null;
      }

      const data: unknown = await response.json();
      return isCatalog(data) ? data : null;
    } catch {
      return null;
    }
  }
}

function isCatalog(value: unknown): value is Catalog {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<Catalog>;
  return typeof candidate.version === 'number' && Array.isArray(candidate.sources);
}
