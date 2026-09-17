import { computed, inject, Injectable } from '@angular/core';

import { CalendarSourceDao } from '@app/data/daos/calendar-source.dao';
import { CalendarChipsStore } from '@app/data/stores/calendar-chips.store';
import type { CalendarRecord, CalendarSourceType } from '@app/data/entities/calendar-source.record';

/**
 * Default chip order by source type: the app's own calendar first, then the device's, then the
 * calendars shipped with the app. Within a group the chips are alphabetical. A calendar the user
 * has placed by hand is ordered by that placement instead; this decides the rest.
 */
const SOURCE_TYPE_ORDER: Record<CalendarSourceType, number> = { app: 0, device: 1, ics: 2 };

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
  private readonly chips = inject(CalendarChipsStore);

  /**
   * The calendars the Kalender screen currently leaves out. Persisted, so hiding one survives a
   * tab switch and an app restart - it used to be page state and came back on every rebuild.
   *
   * The Today screen deliberately does not read this: its list is „what is on today“, not a view
   * of the calendar the filter belongs to.
   */
  readonly hiddenIds = computed<ReadonlySet<string>>(
    () => new Set(this.chips.preferences().hiddenCalendarIds),
  );

  toggleHidden(calendarId: string): void {
    const hidden = new Set(this.chips.preferences().hiddenCalendarIds);
    if (!hidden.delete(calendarId)) {
      hidden.add(calendarId);
    }

    this.chips.update({ hiddenCalendarIds: [...hidden] });
  }

  /**
   * Moves a calendar to `toIndex` in the chip order and persists the result.
   *
   * The stored order is rewritten from the full current list rather than patched, so ids of
   * calendars that are gone drop out on the next move instead of accumulating.
   */
  async move(calendarId: string, toIndex: number): Promise<void> {
    const options = await this.listFilterable();
    const from = options.findIndex((option) => option.id === calendarId);
    if (from === -1) {
      return;
    }

    const ordered = [...options];
    const [moved] = ordered.splice(from, 1);
    ordered.splice(Math.max(0, Math.min(toIndex, ordered.length)), 0, moved);

    this.chips.update({ calendarOrder: ordered.map((option) => option.id) });
  }

  async listFilterable(): Promise<CalendarFilterOption[]> {
    const [sources, calendars] = await Promise.all([
      this.sources.listSources(),
      this.sources.listCalendars(),
    ]);

    const sourceTypeById = new Map(sources.map((source) => [source.id, source.type]));
    const enabledSourceIds = new Set(
      sources.filter((source) => source.enabled).map((source) => source.id),
    );

    const rankOf = (calendar: CalendarRecord): number => {
      const sourceType = sourceTypeById.get(calendar.sourceId);
      return sourceType ? SOURCE_TYPE_ORDER[sourceType] : SOURCE_TYPE_ORDER.ics;
    };

    // The user's own arrangement wins; anything they have not placed follows in the default order,
    // so a calendar connected after the last reordering appears at the end rather than at random.
    const order = this.chips.preferences().calendarOrder;
    const placedAt = new Map(order.map((id, index) => [id, index]));
    const rankOfPlacement = (calendar: CalendarRecord): number =>
      placedAt.get(calendar.id) ?? Number.MAX_SAFE_INTEGER;

    return calendars
      .filter((calendar) => calendar.enabled && enabledSourceIds.has(calendar.sourceId))
      .sort(
        (one, other) =>
          rankOfPlacement(one) - rankOfPlacement(other) ||
          rankOf(one) - rankOf(other) ||
          one.name.localeCompare(other.name),
      )
      .map((calendar) => ({
        id: calendar.id,
        name: calendar.name,
        color: calendar.color,
        emoji: calendar.emoji,
      }));
  }
}
