import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { formatDayLong } from '@app/cross-cutting/helpers/date-format';
import type { CalendarOccurrence } from '@app/interactors/calendar/calendar-occurrence.vm';
import { OccurrenceCard } from '@app/view/components/occurrence-card/occurrence-card';

/**
 * The selected day's appointments below the calendar grid: date heading, the day's occurrence
 * cards, an empty state, and „Neuer Termin" always at the end.
 */
@Component({
  selector: 'app-calendar-agenda',
  host: { class: 'block' },
  imports: [OccurrenceCard, RouterLink],
  templateUrl: './calendar-agenda.block.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarAgendaBlock {
  readonly day = input.required<string>();
  /** The whole loaded range; the block picks out what touches `day`. */
  readonly occurrences = input.required<readonly CalendarOccurrence[]>();
  /** Passed through to the cards' `DatePipe`; unset means device zone. For deterministic tests. */
  readonly timeZone = input<string>();

  protected readonly dayLabel = computed(() => formatDayLong(this.day()));

  /**
   * All-day entries and spans that cover the whole day come first, then the timed ones — a stable
   * partition, not a sort: within each group the interactor's chronological order is kept as-is.
   */
  protected readonly entries = computed<readonly CalendarOccurrence[]>(() => {
    const day = this.day();
    const touching = this.occurrences().filter((o) => o.startDay <= day && day <= o.endDay);
    const wholeDay = touching.filter((o) => o.allDay || o.startDay < day);
    const timed = touching.filter((o) => !(o.allDay || o.startDay < day));

    return [...wholeDay, ...timed];
  });

  protected readonly announcement = computed(() => {
    const count = this.entries().length;
    const countText = count === 0 ? 'keine Termine' : count === 1 ? '1 Termin' : `${count} Termine`;

    return `${this.dayLabel()}: ${countText}`;
  });
}
