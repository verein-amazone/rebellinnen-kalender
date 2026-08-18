import { LiveAnnouncer } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { LucideExternalLink } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';

import { DevicePlatformService } from '@app/cross-cutting/infrastructure/device-platform';
import { AppCalendarsInteractor } from '@app/interactors/calendar/app-calendars.interactor';
import {
  DeviceCalendarsInteractor,
  type DeviceCalendarPermission,
} from '@app/interactors/calendar/device-calendars.interactor';
import { CalendarAvatar } from '@app/view/components/calendar-avatar/calendar-avatar';
import { ToggleField } from '@app/view/components/field/toggle-field';
import { SheetService } from '@app/view/components/sheet/sheet.service';
import {
  CalendarIdentityEditDialog,
  type CalendarIdentityEditDialogData,
  type CalendarIdentityEditResult,
} from '@app/view/dialogs/calendar-identity-edit/calendar-identity-edit.dialog';
import {
  ConfirmationDialog,
  type ConfirmationDialogData,
} from '@app/view/dialogs/confirmation/confirmation.dialog';
import { FocusedScreenScaffold } from '@app/view/scaffolds/focused-screen/focused-screen.scaffold';

/**
 * „Kalender verwalten“ (#20): the app calendar's identity editor and the device-calendar connection
 * flow — connect, list, enable/disable individual calendars, disconnect.
 *
 * Both sections use `resource()` and reload after every write, per the frontend-architecture
 * convention; there is no persisted list cache here, matching `view/blocks/reminder-list/`.
 */
@Component({
  selector: 'app-settings-calendars',
  // Component hosts are unknown elements and therefore inline by default.
  host: { class: 'block' },
  imports: [FocusedScreenScaffold, CalendarAvatar, ToggleField, LucideExternalLink],
  templateUrl: './calendars.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarsPage {
  private readonly appCalendars = inject(AppCalendarsInteractor);
  private readonly deviceCalendars = inject(DeviceCalendarsInteractor);
  private readonly sheets = inject(SheetService);
  private readonly announcer = inject(LiveAnnouncer);

  /** Device calendars are an OS concept; there is nothing to connect to in a browser tab. */
  protected readonly isNativePlatform = inject(DevicePlatformService).platform !== 'web';

  private readonly appCalendarsResource = resource({
    loader: () => this.appCalendars.listWritable(),
  });

  /** Only ever one row today — there is no "add another app calendar" flow yet. */
  protected readonly appCalendar = computed(
    () =>
      this.appCalendarsResource.value()?.find((calendar) => calendar.sourceType !== 'device') ??
      null,
  );

  protected readonly deviceResource = resource({
    loader: () => this.deviceCalendars.loadSnapshot(),
  });

  /**
   * Set only after an explicit connect attempt, since a denied permission leaves no source row in
   * the database at all — there is nothing in `deviceResource` to tell "never tried" and "just
   * denied" apart otherwise.
   */
  protected readonly lastPermission = signal<DeviceCalendarPermission | null>(null);

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
        { heading: 'Kalender bearbeiten', mode: 'full', data },
      ).closed,
    );
    if (result === undefined) {
      return;
    }

    await this.appCalendars.updateIdentity(calendar.id, result);
    this.appCalendarsResource.reload();
    this.announcer.announce('Kalender gespeichert');
  }

  protected async connectDeviceCalendars(): Promise<void> {
    const permission = await this.deviceCalendars.connect();
    this.lastPermission.set(permission);
    this.deviceResource.reload();

    if (permission === 'granted') {
      this.announcer.announce('Gerätekalender verbunden');
    } else {
      this.announcer.announce('Zugriff auf den Gerätekalender wurde nicht erteilt');
    }
  }

  protected async openAppSettings(): Promise<void> {
    await this.deviceCalendars.openAppSettings();
  }

  protected async toggleDeviceCalendar(calendarId: string, enabled: boolean): Promise<void> {
    await this.deviceCalendars.setCalendarEnabled(calendarId, enabled);
    this.deviceResource.reload();
  }

  /**
   * The device never reports an emoji of its own, so its avatar doubles as the picker trigger —
   * unlike name/colour, which come from the OS and are read-only here.
   */
  protected async pickDeviceCalendarEmoji(calendarId: string): Promise<void> {
    const emoji = await this.deviceCalendars.pickEmoji();
    if (emoji === null) {
      return;
    }

    await this.deviceCalendars.setCalendarEmoji(calendarId, emoji);
    this.deviceResource.reload();
  }

  protected async toggleSourceGroup(
    nativeSourceId: string | null,
    enabled: boolean,
  ): Promise<void> {
    await this.deviceCalendars.setCalendarsEnabledByNativeSource(nativeSourceId, enabled);
    this.deviceResource.reload();
  }

  protected confirmDisconnect(): void {
    const data: ConfirmationDialogData = {
      message:
        'Der Gerätekalender wird getrennt. Termine aus dem Gerätekalender werden nicht mehr angezeigt, bis du erneut verbindest.',
      confirmLabel: 'Trennen',
      destructive: true,
    };

    this.sheets
      .open<boolean, ConfirmationDialogData>(ConfirmationDialog, {
        heading: 'Verbindung trennen?',
        data,
      })
      .closed.subscribe((confirmed) => {
        if (confirmed !== true) {
          return;
        }

        void this.disconnect();
      });
  }

  private async disconnect(): Promise<void> {
    await this.deviceCalendars.disconnect();
    this.lastPermission.set(null);
    this.deviceResource.reload();
    this.announcer.announce('Gerätekalender getrennt');
  }
}
