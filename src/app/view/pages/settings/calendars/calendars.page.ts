import { LiveAnnouncer } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { LucideChevronRight } from '@lucide/angular';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { DevicePlatformService } from '@app/cross-cutting/infrastructure/device-platform';
import { AppCalendarsInteractor } from '@app/interactors/calendar/app-calendars.interactor';
import { CalendarAvatar } from '@app/view/components/calendar-avatar/calendar-avatar';
import { SheetService } from '@app/view/components/sheet/sheet.service';
import {
  CalendarIdentityEditDialog,
  EMOJI_PICKER,
  type CalendarIdentityEditDialogData,
  type CalendarIdentityEditResult,
} from '@app/view/dialogs/calendar-identity-edit/calendar-identity-edit.dialog';
import { FocusedScreenScaffold } from '@app/view/scaffolds/focused-screen/focused-screen.scaffold';

/**
 * „Kalender verwalten“ (#20): the app calendar's identity editor, plus links into the
 * device-calendar and ICS-subscription screens, each a self-contained flow of its own (#25
 * follow-up split them out of what used to be one long page).
 *
 * Uses `resource()` and reloads after every write, per the frontend-architecture convention;
 * there is no persisted list cache here, matching `view/blocks/reminder-list/`.
 */
@Component({
  selector: 'app-settings-calendars',
  // Component hosts are unknown elements and therefore inline by default.
  host: { class: 'block' },
  imports: [FocusedScreenScaffold, CalendarAvatar, RouterLink, LucideChevronRight],
  templateUrl: './calendars.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarsPage {
  private readonly appCalendars = inject(AppCalendarsInteractor);
  private readonly sheets = inject(SheetService);
  private readonly announcer = inject(LiveAnnouncer);

  /** Device calendars are an OS concept; there is nothing to connect to in a browser tab. */
  protected readonly isNativePlatform = inject(DevicePlatformService).platform !== 'web';

  private readonly appCalendarsResource = resource({
    loader: () => this.appCalendars.listWritable(),
  });

  /** Only ever one row today - there is no "add another app calendar" flow yet. */
  protected readonly appCalendar = computed(
    () =>
      this.appCalendarsResource.value()?.find((calendar) => calendar.sourceType !== 'device') ??
      null,
  );

  protected async editAppCalendarIdentity(): Promise<void> {
    const calendar = this.appCalendar();
    if (calendar === null) {
      return;
    }

    const data: CalendarIdentityEditDialogData = {
      name: calendar.name,
      color: calendar.color,
      emoji: calendar.emoji,
    };

    const result = await firstValueFrom(
      this.sheets.open<CalendarIdentityEditResult, CalendarIdentityEditDialogData>(
        CalendarIdentityEditDialog,
        {
          heading: 'Kalender bearbeiten',
          mode: 'full',
          data,
          providers: [{ provide: EMOJI_PICKER, useValue: () => this.appCalendars.pickEmoji() }],
        },
      ).closed,
    );
    if (result === undefined) {
      return;
    }

    await this.appCalendars.updateIdentity(calendar.id, result);
    this.appCalendarsResource.reload();
    this.announcer.announce('Kalender gespeichert');
  }
}
