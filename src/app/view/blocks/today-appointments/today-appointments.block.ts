import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucidePlus, LucideRotateCw } from '@lucide/angular';

import { LocalDay } from '@app/cross-cutting/infrastructure/local-day';
import type { CalendarOccurrence } from '@app/interactors/calendar/calendar-occurrence.vm';
import { CalendarOccurrencesInteractor } from '@app/interactors/calendar/calendar-occurrences.interactor';
import { selectUpcomingAppointments } from '@app/interactors/today/upcoming-appointments';
import { OccurrenceCard } from '@app/view/components/occurrence-card/occurrence-card';

/**
 * The Today page's own appointments section: the next few of today's occurrences, a link to the
 * full Calendar for the rest, and „Neuer Termin" - a day-scoped sibling of `CalendarAgendaBlock`,
 * not a reuse of it, because the page already shows the date once in its header and a second,
 * full-date `h2` here would repeat it.
 */
@Component({
  selector: 'app-today-appointments',
  host: { class: 'block' },
  imports: [LucidePlus, LucideRotateCw, OccurrenceCard, RouterLink],
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

  private readonly todayOccurrences = computed<readonly CalendarOccurrence[]>(
    () => this.occurrences.value() ?? [],
  );

  /**
   * Read when the occurrences load, not on a timer, like the closing message: an
   * appointment that ends while the page stays open drops out on the next visit or reload.
   */
  protected readonly entries = computed(() =>
    selectUpcomingAppointments(this.todayOccurrences(), new Date().toISOString()),
  );

  /** Something was planned today, but all of it is over - which reads differently from nothing. */
  protected readonly allOver = computed(
    () => this.todayOccurrences().length > 0 && this.entries().length === 0,
  );

  protected reload(): void {
    this.occurrences.reload();
  }
}
