import { inject, Injectable } from '@angular/core';

import {
  CuratedCalendarSync,
  type Catalog,
} from '@app/data/calendar/curated/curated-calendar-sync';
import { CalendarSourceDao } from '@app/data/daos/calendar-source.dao';
import { IcsSubscriptionDao } from '@app/data/daos/ics-subscription.dao';
import type { CalendarSourceState } from '@app/data/entities/calendar-source.record';

import { IcsSubscriptionInteractor, type IcsRefreshOutcome } from './ics-subscription.interactor';

/** One curated calendar source as the management screen lists it. */
export interface CuratedCalendarRow {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly color: string | null;
  readonly emoji: string | null;
  readonly enabled: boolean;
  readonly state: CalendarSourceState;
  readonly lastError: string | null;
}

/**
 * The curated calendar sources shipped with the app (Amazone and partner calendars, e.g. Austrian
 * public holidays, #2): fixed by `curated-calendars/catalog.json`, users may only enable/disable
 * them and change their colour/emoji - never add or remove one.
 *
 * A curated source is a read-only ICS subscription like any other, just seeded from the catalog and
 * correlated with it via `curatedId`; this interactor composes `IcsSubscriptionInteractor` for the
 * shared mechanics (refresh, identity, enable/disable) rather than duplicating them.
 */
@Injectable({ providedIn: 'root' })
export class CuratedCalendarsInteractor {
  private readonly sync = inject(CuratedCalendarSync);
  private readonly icsSubscriptions = inject(IcsSubscriptionInteractor);
  private readonly sources = inject(CalendarSourceDao);
  private readonly subscriptions = inject(IcsSubscriptionDao);

  /** Renames the subscription's calendar or changes its colour/emoji identity. */
  updateIdentity(
    subscriptionId: string,
    identity: { name: string; color: string | null; emoji: string | null },
  ): Promise<void> {
    return this.icsSubscriptions.updateIdentity(subscriptionId, identity);
  }

  /**
   * Enables or disables the subscription; its source and calendar flip together. A source switched
   * off in the introduction was never downloaded and has nothing to show, so switching it on later
   * downloads it right away rather than on the next start. Inside the introduction it is still
   * waiting for its first download, which the next calendar screen does.
   */
  async setEnabled(subscriptionId: string, enabled: boolean): Promise<void> {
    await this.icsSubscriptions.setEnabled(subscriptionId, enabled);
    if (!enabled || this.sync.awaitsFirstDownload(subscriptionId)) {
      return;
    }

    const subscription = await this.subscriptions.find(subscriptionId);
    if (subscription?.lastAttemptAt === null) {
      await this.icsSubscriptions.refresh(subscriptionId, { force: true });
    }
  }

  /** Retries a subscription's download, e.g. from the management screen's error state. */
  refresh(subscriptionId: string, options: { force?: boolean } = {}): Promise<IcsRefreshOutcome> {
    return this.icsSubscriptions.refresh(subscriptionId, options);
  }

  /** Opens the emoji picker; resolves `null` when the user dismisses it without a selection. */
  pickEmoji(): Promise<string | null> {
    return this.icsSubscriptions.pickEmoji();
  }

  /**
   * Ensures every catalog entry has a seeded source, downloads any newly seeded one, then lists
   * every curated source joined with its calendar identity and catalog description.
   */
  async listForManagement(): Promise<CuratedCalendarRow[]> {
    const { catalog, createdSubscriptionIds } = await this.sync.ensureSynced();

    for (const subscriptionId of createdSubscriptionIds) {
      await this.icsSubscriptions.refresh(subscriptionId, { force: true });
    }

    return this.list(catalog);
  }

  /**
   * The same list for the introduction's choice step: seeds every catalog entry but downloads
   * nothing, so a calendar switched off there is never contacted. The first download happens on
   * the first calendar-showing screen, for the sources still enabled by then.
   */
  async listForIntroduction(): Promise<CuratedCalendarRow[]> {
    return this.list(await this.sync.ensureSeeded());
  }

  private async list(catalog: Catalog | null): Promise<CuratedCalendarRow[]> {
    const catalogEntries = catalog?.sources ?? [];
    const descriptionByCatalogId = new Map(
      catalogEntries.map((entry) => [entry.id, entry.description]),
    );
    // The catalog decides the order, not the seeding timestamps: an entry added to a later catalog
    // version is seeded last on an existing install but may still belong at the top of the list.
    const catalogOrderById = new Map(catalogEntries.map((entry, index) => [entry.id, index]));

    const [sources, calendars, subscriptions] = await Promise.all([
      this.sources.listSources(),
      this.sources.listCalendars(),
      this.subscriptions.list(),
    ]);

    const calendarBySourceId = new Map(calendars.map((calendar) => [calendar.sourceId, calendar]));
    const subscriptionById = new Map(
      subscriptions.map((subscription) => [subscription.id, subscription]),
    );

    const rows: { readonly row: CuratedCalendarRow; readonly order: number }[] = [];
    for (const source of sources) {
      if (source.type !== 'ics') {
        continue;
      }

      const subscription = subscriptionById.get(source.id);
      if (subscription === undefined || subscription.curatedId === null) {
        continue;
      }

      const calendar = calendarBySourceId.get(source.id);
      rows.push({
        // An entry the current catalog no longer lists keeps its seeded position at the end.
        order: catalogOrderById.get(subscription.curatedId) ?? Number.MAX_SAFE_INTEGER,
        row: {
          id: source.id,
          name: calendar?.name ?? source.name,
          description: descriptionByCatalogId.get(subscription.curatedId) ?? '',
          color: calendar?.color ?? null,
          emoji: calendar?.emoji ?? null,
          enabled: source.enabled,
          state: source.state,
          lastError: subscription.lastError,
        },
      });
    }

    return rows.sort((a, b) => a.order - b.order).map((entry) => entry.row);
  }
}
