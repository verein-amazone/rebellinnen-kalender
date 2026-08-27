import { inject, Injectable } from '@angular/core';

import { CalendarSourceDao } from '@app/data/daos/calendar-source.dao';

/** One calendar the source-filter chips may offer, stripped of everything view-irrelevant. */
export interface CalendarFilterOption {
  readonly id: string;
  readonly name: string;
  readonly color: string | null;
  readonly emoji: string | null;
}

/**
 * The Calendar view's source-filter chips' data source (#18).
 *
 * Lists every calendar that can ever produce a visible occurrence - an enabled calendar of an
 * enabled source, across every source type - so a disabled or disconnected source never grows a
 * stale filter chip. This mirrors the gating `CalendarRepository.occurrencesInRange` already
 * applies, without `AppCalendarsInteractor.listWritable()`'s picker-only writable restriction.
 */
@Injectable({ providedIn: 'root' })
export class CalendarFiltersInteractor {
  private readonly sources = inject(CalendarSourceDao);

  async listFilterable(): Promise<CalendarFilterOption[]> {
    const [sources, calendars] = await Promise.all([
      this.sources.listSources(),
      this.sources.listCalendars(),
    ]);

    const enabledSourceIds = new Set(
      sources.filter((source) => source.enabled).map((source) => source.id),
    );

    return calendars
      .filter((calendar) => calendar.enabled && enabledSourceIds.has(calendar.sourceId))
      .map((calendar) => ({
        id: calendar.id,
        name: calendar.name,
        color: calendar.color,
        emoji: calendar.emoji,
      }));
  }
}
