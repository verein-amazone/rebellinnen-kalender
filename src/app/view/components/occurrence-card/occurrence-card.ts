import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { CalendarOccurrence } from '@app/interactors/calendar/calendar-occurrence.vm';

/**
 * One appointment as a tappable card, linking to its detail screen. Every list of appointments —
 * the calendar's day agenda, the Today screen — renders occurrences through this component, so they
 * cannot drift apart in how a time, an all-day entry or a calendar name is shown.
 */
@Component({
  selector: 'app-occurrence-card',
  host: { class: 'block' },
  imports: [DatePipe, RouterLink],
  templateUrl: './occurrence-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OccurrenceCard {
  readonly occurrence = input.required<CalendarOccurrence>();
  /** The day this card is shown under — a spanning occurrence reads differently mid-span. */
  readonly day = input.required<string>();
  /**
   * Passed to `DatePipe`, so an offset such as `'+0200'` — for deterministic tests. Left unset,
   * times render in the device zone, which is the right zone everywhere else.
   */
  readonly timeZone = input<string>();

  /**
   * An occurrence covers the shown day entirely when it is all-day, or when it started on an
   * earlier day — mid-span there is no meaningful time to show, so it reads as „Ganztägig".
   */
  protected readonly coversWholeDay = computed(
    () => this.occurrence().allDay || this.occurrence().startDay < this.day(),
  );
}
