import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideChevronLeft, LucideChevronRight } from '@lucide/angular';
import { Temporal } from 'temporal-polyfill';

import {
  addMonths,
  addWeeks,
  monthGridRange,
  weekRange,
} from '@app/cross-cutting/helpers/calendar-days';
import { formatMonthYear, formatWeekRangeLabel } from '@app/cross-cutting/helpers/date-format';
import { LocalDay } from '@app/cross-cutting/infrastructure/local-day';
import {
  CalendarOccurrencesInteractor,
  type OccurrenceFilter,
} from '@app/interactors/calendar/calendar-occurrences.interactor';
import { DeviceCalendarSyncInteractor } from '@app/interactors/calendar/device-calendar-sync.interactor';
import type { CalendarOccurrence } from '@app/interactors/calendar/calendar-occurrence.vm';
import { CalendarAgendaBlock } from '@app/view/blocks/calendar-agenda/calendar-agenda.block';
import {
  CalendarGridBlock,
  type DayMarker,
} from '@app/view/blocks/calendar-grid/calendar-grid.block';

type ViewMode = 'week' | 'month';

/**
 * The calendar screen: week or month grid on top, the selected day's agenda below.
 *
 * View mode and selected day are route state (`?view=…&day=…`), so a deep link, a tab switch or an
 * app restart land on the same picture. Navigation replaces the URL rather than pushing: paging
 * through months must not stack up as that many back presses.
 */
@Component({
  selector: 'app-calendar-overview',
  // Component hosts are unknown elements and therefore inline by default.
  host: { class: 'block' },
  imports: [CalendarAgendaBlock, CalendarGridBlock, LucideChevronLeft, LucideChevronRight],
  templateUrl: './overview.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarOverviewPage {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly occurrencesInteractor = inject(CalendarOccurrencesInteractor);
  private readonly deviceCalendarSync = inject(DeviceCalendarSyncInteractor);
  private readonly localDay = inject(LocalDay);

  constructor() {
    // The "calendar screen" trigger `DeviceCalendarSyncInteractor`'s own doc comment promises:
    // an external change (edited in Google Calendar, synced in by the OS in the background) has
    // otherwise no way to reach this screen until the next debounced refresh happens to land.
    // `refresh()` is debounced, not `force`, so revisiting the screen repeatedly is cheap; the
    // occurrences resource is reloaded afterwards so a genuinely fresh cache is not stuck behind
    // the range param not having changed.
    void this.deviceCalendarSync.refresh().then(() => this.occurrences.reload());
  }

  /** Bound from the `view` query parameter. Anything but `month` reads as the week view. */
  readonly view = input<string>();
  /** Bound from the `day` query parameter, `YYYY-MM-DD`. Invalid or absent falls back to today. */
  readonly day = input<string>();

  protected readonly today = this.localDay.day;
  protected readonly viewMode = computed<ViewMode>(() =>
    this.view() === 'month' ? 'month' : 'week',
  );
  protected readonly selectedDay = computed(() => {
    const day = this.day();

    return day !== undefined && isPlainDate(day) ? day : this.today();
  });

  /** Seam for the source filters of #18; until then every visible source is queried. */
  private readonly filter = computed<OccurrenceFilter | undefined>(() => undefined);

  /**
   * The loaded range: the visible week, or the month's full grid including its edge days. Value
   * equality on purpose — selecting another day inside the same range must not look like a change,
   * or the resource below would reload on every tap.
   */
  private readonly range = computed(
    () =>
      this.viewMode() === 'month'
        ? monthGridRange(this.selectedDay())
        : weekRange(this.selectedDay()),
    { equal: (a, b) => a.fromDay === b.fromDay && a.toDay === b.toDay },
  );

  protected readonly occurrences = resource({
    params: () => `${this.range().fromDay}:${this.range().toDay}`,
    loader: ({ params }) => {
      const [fromDay, toDay] = params.split(':');

      return this.occurrencesInteractor.listForDays(fromDay, toDay, this.filter());
    },
  });

  protected readonly loadedOccurrences = computed<readonly CalendarOccurrence[]>(
    () => this.occurrences.value() ?? [],
  );

  protected readonly periodLabel = computed(() => {
    const { fromDay, toDay } = this.range();

    return this.viewMode() === 'month'
      ? formatMonthYear(this.selectedDay())
      : formatWeekRangeLabel(fromDay, toDay);
  });

  protected readonly previousLabel = computed(() =>
    this.viewMode() === 'month' ? 'Vorheriger Monat' : 'Vorherige Woche',
  );
  protected readonly nextLabel = computed(() =>
    this.viewMode() === 'month' ? 'Nächster Monat' : 'Nächste Woche',
  );

  /** Indicator dots and counts per visible day. A multi-day occurrence marks every day it touches. */
  protected readonly markersByDay = computed<ReadonlyMap<string, DayMarker>>(() => {
    const { fromDay, toDay } = this.range();
    const perDay = new Map<string, { colors: string[]; count: number }>();

    for (const occurrence of this.loadedOccurrences()) {
      const first = occurrence.startDay < fromDay ? fromDay : occurrence.startDay;
      const last = occurrence.endDay > toDay ? toDay : occurrence.endDay;
      let cursor = Temporal.PlainDate.from(first);
      const end = Temporal.PlainDate.from(last);

      while (Temporal.PlainDate.compare(cursor, end) <= 0) {
        const day = cursor.toString();
        const marker = perDay.get(day) ?? { colors: [], count: 0 };
        marker.count += 1;
        const color = occurrence.calendarColor;
        if (color !== null && !marker.colors.includes(color)) {
          marker.colors.push(color);
        }
        perDay.set(day, marker);
        cursor = cursor.add({ days: 1 });
      }
    }

    return perDay;
  });

  protected goToPrevious(): void {
    this.navigate({ day: this.step(-1) });
  }

  protected goToNext(): void {
    this.navigate({ day: this.step(1) });
  }

  protected goToToday(): void {
    this.navigate({ view: this.viewMode(), day: this.today() });
  }

  protected selectDay(day: string): void {
    this.navigate({ day });
  }

  protected setView(view: ViewMode): void {
    this.navigate({ view, day: this.selectedDay() });
  }

  private step(direction: -1 | 1): string {
    return this.viewMode() === 'month'
      ? addMonths(this.selectedDay(), direction)
      : addWeeks(this.selectedDay(), direction);
  }

  private navigate(queryParams: { view?: ViewMode; day: string }): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}

function isPlainDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  try {
    Temporal.PlainDate.from(value, { overflow: 'reject' });
    return true;
  } catch {
    return false;
  }
}
