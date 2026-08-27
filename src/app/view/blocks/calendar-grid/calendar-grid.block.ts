import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { Temporal } from 'temporal-polyfill';

import { daysInRange, monthGridRange, weekRange } from '@app/cross-cutting/helpers/calendar-days';
import { WEEKDAY_HEADERS, formatDayLong } from '@app/cross-cutting/helpers/date-format';

/** What a day cell shows about its appointments: dot colours (already deduplicated) and the count. */
export interface DayMarker {
  readonly colors: readonly string[];
  readonly count: number;
}

interface DayCell {
  readonly day: string;
  readonly dayNumber: number;
  readonly inShownMonth: boolean;
  /** „5. Mittwoch, 5. August 2026, 2 Termine" - day number first, matching the visible label. */
  readonly srLabel: string;
  readonly colors: readonly string[];
}

/** At most this many indicator dots per day; the exact count is in the cell's accessible name. */
const MAX_DOTS = 3;

/** How far one arrow press moves, in days. */
const KEY_STEPS: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

/**
 * The week strip or month grid. Pure presentation: days and markers come in, a tapped day goes out -
 * loading and selection state stay with the page.
 *
 * For the keyboard the whole grid is a single tab stop with a roving tabindex, the composite-widget
 * half of the APG date-picker pattern: Tab lands on one day, the arrow keys move by day and by week,
 * Home/End jump inside the week, Enter/Space select. Up to 42 cells as individual tab stops would
 * make reaching anything behind the grid a chore. The cells stay plain `<button>`s rather than an
 * ARIA `grid`, because each cell already names its full date - row/column semantics would add
 * table-navigation announcements without adding information.
 */
@Component({
  selector: 'app-calendar-grid',
  host: { class: 'block' },
  templateUrl: './calendar-grid.block.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarGridBlock {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly view = input.required<'week' | 'month'>();
  readonly selectedDay = input.required<string>();
  readonly today = input.required<string>();
  readonly markersByDay = input<ReadonlyMap<string, DayMarker>>(new Map());

  readonly daySelected = output<string>();

  protected readonly weekdayHeaders = WEEKDAY_HEADERS;

  private readonly range = computed(() =>
    this.view() === 'month' ? monthGridRange(this.selectedDay()) : weekRange(this.selectedDay()),
  );

  /**
   * The one cell in the tab order. Follows the selection whenever the shown period changes, and
   * roves from there while the user arrows around without selecting.
   */
  private readonly focusedDay = linkedSignal(() => this.selectedDay());

  protected readonly tabStopDay = computed(() => {
    const focused = this.focusedDay();
    const { fromDay, toDay } = this.range();

    return focused >= fromDay && focused <= toDay ? focused : fromDay;
  });

  protected readonly cells = computed<readonly DayCell[]>(() => {
    const isMonthView = this.view() === 'month';
    const shownMonth = Temporal.PlainDate.from(this.selectedDay());
    const markers = this.markersByDay();
    const { fromDay, toDay } = this.range();

    return daysInRange(fromDay, toDay).map((day) => {
      const date = Temporal.PlainDate.from(day);
      const marker = markers.get(day);

      return {
        day,
        dayNumber: date.day,
        inShownMonth:
          !isMonthView || (date.year === shownMonth.year && date.month === shownMonth.month),
        srLabel: `. ${formatDayLong(day)}, ${countLabel(marker?.count ?? 0)}`,
        colors: (marker?.colors ?? []).slice(0, MAX_DOTS),
      };
    });
  });

  protected onKeydown(event: KeyboardEvent): void {
    const target = this.keyTarget(event.key);
    if (target === null) {
      return;
    }

    event.preventDefault();
    this.focusedDay.set(target);
    this.host.nativeElement
      .querySelector<HTMLButtonElement>(`button[data-day="${target}"]`)
      ?.focus();
  }

  /** Where the pressed key moves the roving focus, or `null` for keys this grid does not handle. */
  private keyTarget(key: string): string | null {
    const from = this.tabStopDay();

    if (key in KEY_STEPS) {
      const moved = Temporal.PlainDate.from(from).add({ days: KEY_STEPS[key] }).toString();
      const { fromDay, toDay } = this.range();

      // Clamped to the shown period; the header's period controls change what is shown.
      return moved >= fromDay && moved <= toDay ? moved : null;
    }

    if (key === 'Home' || key === 'End') {
      const week = weekRange(from);

      return key === 'Home' ? week.fromDay : week.toDay;
    }

    return null;
  }
}

function countLabel(count: number): string {
  if (count === 0) {
    return 'keine Termine';
  }

  return count === 1 ? '1 Termin' : `${count} Termine`;
}
