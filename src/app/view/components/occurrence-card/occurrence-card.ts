import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink, type Params } from '@angular/router';

import type { CalendarOccurrence } from '@app/interactors/calendar/calendar-occurrence.vm';

/**
 * One appointment as a tappable card, linking to its detail screen. Every list of appointments -
 * the calendar's day agenda, the Today screen - renders occurrences through this component, so they
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
  /** The day this card is shown under - a spanning occurrence reads differently mid-span. */
  readonly day = input.required<string>();
  /**
   * Passed to `DatePipe`, so an offset such as `'+0200'` - for deterministic tests. Left unset,
   * times render in the device zone, which is the right zone everywhere else.
   */
  readonly timeZone = input<string>();
  /**
   * Query parameters the detail link carries. The detail screen navigates back to an explicit
   * target rather than walking history (see `FocusedScreenScaffold`), so whatever the list it was
   * opened from needs to be restored - the calendar's `?view=`, for one - has to travel with the
   * link.
   */
  readonly linkQueryParams = input<Params | undefined>(undefined);

  private readonly isStartDay = computed(() => this.occurrence().startDay === this.day());
  private readonly isEndDay = computed(() => this.occurrence().endDay === this.day());

  /**
   * A day the occurrence covers but neither starts nor ends on has no meaningful time to show -
   * this is true both for a genuinely all-day occurrence and for a day a multi-day timed one
   * merely passes through.
   */
  protected readonly coversWholeDay = computed(
    () => this.occurrence().allDay || (!this.isStartDay() && !this.isEndDay()),
  );

  /** A timed occurrence that started on an earlier day has a real end time worth showing on the
   * day it ends - just not a start time, since it did not start today. */
  protected readonly endsToday = computed(
    () => !this.occurrence().allDay && this.isEndDay() && !this.isStartDay(),
  );

  /** The mirror of `endsToday`: a timed occurrence that will not end today still has a real start
   * time worth showing, with nothing to pair it with since the end falls on a later day. */
  protected readonly startsToday = computed(
    () => !this.occurrence().allDay && this.isStartDay() && !this.isEndDay(),
  );
}
