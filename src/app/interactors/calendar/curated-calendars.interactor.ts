import { inject, Injectable } from '@angular/core';

import { CuratedCalendarSync } from '@app/data/calendar/curated/curated-calendar-sync';
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

  /** Enables or disables the subscription; its source and calendar flip together. */
  setEnabled(subscriptionId: string, enabled: boolean): Promise<void> {
    return this.icsSubscriptions.setEnabled(subscriptionId, enabled);
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

    const descriptionByCatalogId = new Map(
      (catalog?.sources ?? []).map((entry) => [entry.id, entry.description]),
    );

    const [sources, calendars, subscriptions] = await Promise.all([
      this.sources.listSources(),
      this.sources.listCalendars(),
      this.subscriptions.list(),
    ]);

    const calendarBySourceId = new Map(calendars.map((calendar) => [calendar.sourceId, calendar]));
    const subscriptionById = new Map(
      subscriptions.map((subscription) => [subscription.id, subscription]),
    );

    const rows: CuratedCalendarRow[] = [];
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
        id: source.id,
        name: calendar?.name ?? source.name,
        description: descriptionByCatalogId.get(subscription.curatedId) ?? '',
        color: calendar?.color ?? null,
        emoji: calendar?.emoji ?? null,
        enabled: source.enabled,
        state: source.state,
        lastError: subscription.lastError,
      });
    }

    return rows;
  }
}
