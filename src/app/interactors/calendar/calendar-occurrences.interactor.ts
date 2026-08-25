import { inject, Injectable, Injector } from '@angular/core';
import { Temporal } from 'temporal-polyfill';

import {
  CalendarRepository,
  type OccurrenceFilter,
  type RangeOccurrence,
} from '@app/data/calendar/calendar.repository';
import { CuratedCalendarSync } from '@app/data/calendar/curated/curated-calendar-sync';

import type { CalendarOccurrence } from './calendar-occurrence.vm';

export type { OccurrenceFilter } from '@app/data/calendar/calendar.repository';

/**
 * The unified read side of the calendar: every view — Today, day, week, month, agenda — asks this
 * interactor for the occurrences of a local-day range and renders what it gets. Stateless; the
 * screen holds the result in a `resource()`.
 */
@Injectable({ providedIn: 'root' })
export class CalendarOccurrencesInteractor {
  private readonly repository = inject(CalendarRepository);
  private readonly curatedCalendarSync = inject(CuratedCalendarSync);
  private readonly injector = inject(Injector);

  /**
   * All visible occurrences touching the days `fromDay`…`toDay` (inclusive, device zone),
   * deterministically ordered: by day, all-day entries first, then start time, then title.
   */
  async listForDays(
    fromDay: string,
    toDay: string,
    filter?: OccurrenceFilter,
  ): Promise<CalendarOccurrence[]> {
    // Curated sources (#2) must show up the first time any calendar-showing surface renders, not
    // only after a visit to Settings — cheap after the first call (a local JSON fetch and a
    // version compare), so it belongs on the shared read path rather than on every screen.
    const { createdSubscriptionIds } = await this.curatedCalendarSync.ensureSynced();
    if (createdSubscriptionIds.length > 0) {
      const { IcsSubscriptionInteractor } = await import('./ics-subscription.interactor');
      const icsSubscriptions = this.injector.get(IcsSubscriptionInteractor);
      for (const subscriptionId of createdSubscriptionIds) {
        await icsSubscriptions.refresh(subscriptionId, { force: true });
      }
    }

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const rangeStartUtc = Temporal.PlainDate.from(fromDay)
      .toZonedDateTime(timeZone)
      .toInstant()
      .toString();
    const rangeEndUtc = Temporal.PlainDate.from(toDay)
      .add({ days: 1 })
      .toZonedDateTime(timeZone)
      .toInstant()
      .toString();

    // Navigating close to a coverage edge widens the window first, so the user never runs into
    // an artificial end of the calendar.
    await this.repository.extendCoverageForRange(rangeStartUtc, rangeEndUtc, {
      nowUtc: new Date().toISOString(),
      timeZone,
    });

    const rows = await this.repository.occurrencesInRange(rangeStartUtc, rangeEndUtc, filter);
    return rows.map(toOccurrence);
  }

  /** One occurrence by its id, for a detail view opened from a range list or a deep link. */
  async findById(id: string): Promise<CalendarOccurrence | null> {
    const row = await this.repository.occurrenceById(id);
    return row === null ? null : toOccurrence(row);
  }
}

function toOccurrence(row: RangeOccurrence): CalendarOccurrence {
  return {
    id: row.id,
    sourceId: row.sourceId,
    calendarId: row.calendarId,
    seriesId: row.seriesId,
    originalStart: row.originalStart,
    itemId: row.itemId,
    externalId: row.externalId,
    kind: row.itemKind,
    title: row.title,
    location: row.location,
    description: row.description,
    allDay: row.isAllDay,
    start: row.start,
    end: row.end,
    startUtc: row.startUtc,
    endUtc: row.endUtc,
    startDay: row.startLocalDay,
    endDay: row.endLocalDay,
    actions: row.capabilities,
    stale: row.sourceState !== 'ok',
    sourceName: row.sourceName,
    calendarName: row.calendarName,
    calendarColor: row.calendarColor,
    calendarEmoji: row.calendarEmoji,
  };
}
