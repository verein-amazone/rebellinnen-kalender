import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideRotateCw } from '@lucide/angular';

import { valueOr } from '@app/cross-cutting/helpers/resource-value';
import type { CalendarFilterOption } from '@app/interactors/calendar/calendar-filters.interactor';
import { CalendarRemindersInteractor } from '@app/interactors/notifications/calendar-reminders.interactor';
import { NotificationPreferencesInteractor } from '@app/interactors/notifications/notification-preferences.interactor';
import { NotificationsBlockedBlock } from '@app/view/blocks/notifications-blocked/notifications-blocked.block';
import { CalendarAvatar } from '@app/view/components/calendar-avatar/calendar-avatar';
import { ToggleField } from '@app/view/components/field/toggle-field';
import { FocusedScreenScaffold } from '@app/view/scaffolds/focused-screen/focused-screen.scaffold';

/** The secondary line of a row: where the calendar comes from. */
const SOURCE_LABELS: Record<CalendarFilterOption['sourceType'], string> = {
  app: 'Kalender der App',
  device: 'Gerätekalender',
  ics: 'Abonnierter Kalender',
};

/**
 * „Erinnerungen“: which calendars the app reminds of (#81). One switch per calendar that can show
 * appointments, in the Kalender screen's chip order - the app's own on by default, device and
 * subscribed calendars off until the user turns them on.
 *
 * Under „Kalender verwalten“, next to „Reihenfolge“, because it is a choice per calendar; the
 * „Benachrichtigungen“ screen links here. The times themselves stay there.
 */
@Component({
  selector: 'app-settings-calendar-reminders',
  // Component hosts are unknown elements and therefore inline by default.
  host: { class: 'block' },
  imports: [
    CalendarAvatar,
    FocusedScreenScaffold,
    LucideRotateCw,
    NotificationsBlockedBlock,
    RouterLink,
    ToggleField,
  ],
  templateUrl: './calendar-reminders.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarRemindersPage {
  protected readonly reminders = inject(CalendarRemindersInteractor);

  /** `false` on the web, which cannot deliver a reminder while the app is closed. */
  protected readonly isSupported = inject(NotificationPreferencesInteractor).isSupported;

  protected readonly calendars = resource({ loader: () => this.reminders.list() });

  protected readonly rows = computed(() => valueOr(this.calendars, []));

  protected sourceLabel(calendar: CalendarFilterOption): string {
    return SOURCE_LABELS[calendar.sourceType];
  }

  protected setReminds(calendar: CalendarFilterOption, reminds: boolean): void {
    this.reminders.setReminds(calendar.id, reminds);
  }
}
