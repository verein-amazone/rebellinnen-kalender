import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LocalDay } from '@app/cross-cutting/infrastructure/local-day';
import type { CalendarOccurrence } from '@app/interactors/calendar/calendar-occurrence.vm';
import { CalendarOccurrencesInteractor } from '@app/interactors/calendar/calendar-occurrences.interactor';
import { OccurrenceCard } from '@app/view/components/occurrence-card/occurrence-card';

/**
 * The Today page's own appointments section: today's occurrences, a link to the full Calendar, and
 * „Neuer Termin" — a day-scoped sibling of `CalendarAgendaBlock`, not a reuse of it, because the page
 * already shows the date once in its header and a second, full-date `h2` here would repeat it.
 */
@Component({
  selector: 'app-today-appointments',
  host: { class: 'block' },
  imports: [OccurrenceCard, RouterLink],
  templateUrl: './today-appointments.block.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodayAppointmentsBlock {
  private readonly occurrencesInteractor = inject(CalendarOccurrencesInteractor);
  private readonly currentDay = inject(LocalDay);

  protected readonly today = this.currentDay.day;

  protected readonly occurrences = resource({
    params: () => this.currentDay.day(),
    loader: ({ params: day }) => this.occurrencesInteractor.listForDays(day, day),
  });

  protected readonly entries = computed<readonly CalendarOccurrence[]>(
    () => this.occurrences.value() ?? [],
  );

  protected reload(): void {
    this.occurrences.reload();
  }
}
