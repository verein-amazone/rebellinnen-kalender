import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideCheck } from '@lucide/angular';

import type { CalendarFilterOption } from '@app/interactors/calendar/calendar-filters.interactor';

/**
 * The Calendar view's source filter (#18): one toggle chip per calendar, identified by colour,
 * emoji and name — the same identity `app-occurrence-card` and the calendars settings page show.
 *
 * Pressed state is signalled three ways, never by colour alone: `aria-pressed`, the check icon, and
 * bold text — the same rule the tab bar's active state follows.
 */
@Component({
  selector: 'app-calendar-source-filter',
  host: { class: 'block' },
  imports: [LucideCheck],
  templateUrl: './calendar-source-filter.block.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarSourceFilterBlock {
  readonly calendars = input.required<readonly CalendarFilterOption[]>();
  readonly hiddenIds = input.required<ReadonlySet<string>>();

  readonly toggled = output<string>();

  protected isVisible(calendarId: string): boolean {
    return !this.hiddenIds().has(calendarId);
  }
}
