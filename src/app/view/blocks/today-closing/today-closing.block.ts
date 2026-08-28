import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { Temporal } from 'temporal-polyfill';

import { formatTimeOfDay } from '@app/cross-cutting/helpers/date-format';
import { LocalDay } from '@app/cross-cutting/infrastructure/local-day';
import { ReminderChanges } from '@app/cross-cutting/infrastructure/reminder-changes';
import type { CalendarOccurrence } from '@app/interactors/calendar/calendar-occurrence.vm';
import { CalendarOccurrencesInteractor } from '@app/interactors/calendar/calendar-occurrences.interactor';
import { ReminderListInteractor } from '@app/interactors/reminders/reminder-list.interactor';
import { pickClosingCopy } from '@app/interactors/today/today-closing-copy';
import { selectTodayClosingState } from '@app/interactors/today/today-closing-state';
import type { TodayClosingState } from '@app/interactors/today/today-closing-state.vm';
import { TodayClosingMessage } from '@app/view/components/today-closing-message/today-closing-message';

/**
 * The Today page's closing footer, loaded and resolved to text here - the only place in the feature
 * that talks to the reminders and calendar interactors, so the presentational component underneath
 * stays a plain leaf and `selectTodayClosingState` stays a pure, interactor-free function.
 */
@Component({
  selector: 'app-today-closing',
  host: { class: 'block' },
  imports: [TodayClosingMessage],
  templateUrl: './today-closing.block.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodayClosingBlock {
  private readonly reminders = inject(ReminderListInteractor);
  private readonly occurrences = inject(CalendarOccurrencesInteractor);
  private readonly currentDay = inject(LocalDay);
  private readonly reminderChanges = inject(ReminderChanges);

  protected readonly data = resource({
    // Reloads on a day change as well as any reminder write, even though only the reminders
    // themselves came from the write - the occurrences are cheap to re-read and this keeps the
    // loader a single, simple params function instead of two independently reloading resources.
    params: () => ({
      today: this.currentDay.day(),
      remindersVersion: this.reminderChanges.version(),
    }),
    loader: async ({ params: { today } }) => {
      const tomorrow = Temporal.PlainDate.from(today).add({ days: 1 }).toString();

      // Both days in one range read rather than one call per day: each call runs the whole read
      // path - curated sync, coverage check, range query - and the two days are adjacent anyway.
      const [reminders, occurrences] = await Promise.all([
        this.reminders.list(),
        this.occurrences.listForDays(today, tomorrow),
      ]);

      // Split the same way every day-based view buckets a range: an entry counts for a day when it
      // touches it, so one spanning both days appears in both - exactly as two separate day queries
      // would have returned it.
      const onDay = (day: string) =>
        occurrences.filter((entry) => entry.startDay <= day && day <= entry.endDay);

      return {
        reminders,
        todayOccurrences: onDay(today),
        tomorrowOccurrences: onDay(tomorrow),
        today,
      };
    },
  });

  protected readonly state = computed<TodayClosingState | null>(() => {
    const loaded = this.data.value();
    if (loaded === undefined) {
      return null;
    }

    return selectTodayClosingState({
      reminders: loaded.reminders,
      todayOccurrences: loaded.todayOccurrences,
      tomorrowOccurrences: loaded.tomorrowOccurrences,
      nowUtc: new Date().toISOString(),
    });
  });

  protected readonly headline = computed(() => {
    const state = this.state();
    const today = this.data.value()?.today;
    return state === null || today === undefined
      ? ''
      : resolve(state.headlineKey, today, state, state.nextAppointment);
  });

  protected readonly supportingLine = computed(() => {
    const state = this.state();
    const today = this.data.value()?.today;
    if (state === null || today === undefined || state.supportingLineKey === null) {
      return null;
    }

    return resolve(
      state.supportingLineKey,
      today,
      state,
      state.nextAppointment ?? state.tomorrowAppointment,
    );
  });

  protected readonly appointment = computed(() => this.state()?.nextAppointment ?? null);

  protected reload(): void {
    this.data.reload();
  }
}

/** Resolves a message key to its picked, interpolated text for the day the block loaded. */
function resolve(
  key: string,
  today: string,
  state: TodayClosingState,
  appointment: CalendarOccurrence | null,
): string {
  const text = pickClosingCopy(key, today, state.id);

  return text
    .replace('{count}', String(state.openReminderCount))
    .replace('{time}', appointment === null ? '' : formatTimeOfDay(appointment.startUtc))
    .replace('{title}', appointment?.title ?? '');
}
