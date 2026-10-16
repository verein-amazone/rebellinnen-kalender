import { LiveAnnouncer } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
import { LucidePlus, LucideRotateCw, LucideTrash2 } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';

import { DevicePlatformService } from '@app/cross-cutting/infrastructure/device-platform';
import { IcsSubscriptionInteractor } from '@app/interactors/calendar/ics-subscription.interactor';
import { HapticsInteractor } from '@app/interactors/feedback/haptics.interactor';
import { CalendarAvatar } from '@app/view/components/calendar-avatar/calendar-avatar';
import { ToggleField } from '@app/view/components/field/toggle-field';
import { SheetService } from '@app/view/components/sheet/sheet.service';
import {
  CalendarIdentityEditDialog,
  EMOJI_PICKER,
  type CalendarIdentityEditDialogData,
  type CalendarIdentityEditResult,
} from '@app/view/dialogs/calendar-identity-edit/calendar-identity-edit.dialog';
import {
  ConfirmationDialog,
  type ConfirmationDialogData,
} from '@app/view/dialogs/confirmation/confirmation.dialog';
import { IcsSubscriptionAddDialog } from '@app/view/dialogs/ics-subscription-add/ics-subscription-add.dialog';
import { FocusedScreenScaffold } from '@app/view/scaffolds/focused-screen/focused-screen.scaffold';
import { InfoToggletip } from '@app/view/components/info-toggletip/info-toggletip';

/**
 * „Abonnierte Kalender“: adding, customising, enabling/disabling and removing read-only ICS
 * subscriptions (#25), split out of „Kalender verwalten“ into its own screen (#25 follow-up) since
 * it and the device-calendar screen had each grown into a self-contained flow of their own.
 *
 * Uses `resource()` and reloads after every write, per the frontend-architecture convention; there
 * is no persisted list cache here, matching `view/blocks/reminder-list/`.
 */
@Component({
  selector: 'app-settings-ics-calendars',
  // Component hosts are unknown elements and therefore inline by default.
  host: { class: 'block' },
  imports: [
    InfoToggletip,
    FocusedScreenScaffold,
    CalendarAvatar,
    ToggleField,
    LucideTrash2,
    LucidePlus,
    LucideRotateCw,
  ],
  templateUrl: './ics-calendars.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IcsCalendarsPage {
  private readonly icsSubscriptions = inject(IcsSubscriptionInteractor);

  /**
   * A subscription is downloaded through `IcsHttpGateway`, which only escapes CORS on a device;
   * calendar servers send no `Access-Control-Allow-Origin`, so every refresh fails in a browser.
   * The screen is unreachable from „Kalender verwalten“ on the web and explains itself when a link
   * leads here anyway.
   */
  protected readonly isNativePlatform = inject(DevicePlatformService).platform !== 'web';
  private readonly sheets = inject(SheetService);
  private readonly announcer = inject(LiveAnnouncer);
  private readonly haptics = inject(HapticsInteractor);

  protected readonly icsResource = resource({
    loader: () => this.icsSubscriptions.listForManagement(),
  });

  /** Why the last change on this page failed; cleared by the next one. */
  protected readonly actionError = signal<string | null>(null);

  protected async addIcsSubscription(): Promise<void> {
    const result = await firstValueFrom(
      this.sheets.open<{ subscriptionId: string; outcome: string } | undefined, undefined>(
        IcsSubscriptionAddDialog,
        { heading: 'Kalender per Link hinzufügen', mode: 'full' },
      ).closed,
    );
    if (result === undefined) {
      return;
    }

    this.icsResource.reload();
    // Only a calendar that also loaded is a success; a failed first download is not one to confirm.
    if (result.outcome !== 'failed') {
      void this.haptics.confirm();
    }
    this.announcer.announce(
      result.outcome === 'failed'
        ? 'Kalender hinzugefügt, konnte aber noch nicht geladen werden'
        : 'Kalender hinzugefügt',
    );
  }

  protected async editIcsIdentity(
    subscriptionId: string,
    current: CalendarIdentityEditDialogData,
  ): Promise<void> {
    const result = await firstValueFrom(
      this.sheets.open<CalendarIdentityEditResult, CalendarIdentityEditDialogData>(
        CalendarIdentityEditDialog,
        {
          heading: 'Kalender bearbeiten',
          mode: 'full',
          data: current,
          providers: [{ provide: EMOJI_PICKER, useValue: () => this.icsSubscriptions.pickEmoji() }],
        },
      ).closed,
    );
    if (result === undefined) {
      return;
    }

    const saved = await this.attempt(
      () => this.icsSubscriptions.updateIdentity(subscriptionId, result),
      'Der Kalender konnte nicht gespeichert werden.',
    );
    if (saved) {
      void this.haptics.confirm();
      this.announcer.announce('Kalender gespeichert');
    }
  }

  protected async toggleIcs(subscriptionId: string, enabled: boolean): Promise<void> {
    await this.attempt(
      () => this.icsSubscriptions.setEnabled(subscriptionId, enabled),
      enabled
        ? 'Der Kalender konnte nicht eingeschaltet werden.'
        : 'Der Kalender konnte nicht ausgeschaltet werden.',
    );
  }

  protected async retryIcs(subscriptionId: string): Promise<void> {
    const outcome = await this.icsSubscriptions.refresh(subscriptionId, { force: true });
    this.icsResource.reload();
    this.announcer.announce(
      outcome === 'failed' ? 'Aktualisierung fehlgeschlagen' : 'Kalender aktualisiert',
    );
  }

  protected confirmRemoveIcs(subscriptionId: string, name: string): void {
    const data: ConfirmationDialogData = {
      message: `„${name}“ wird entfernt. Termine aus diesem Kalender werden nicht mehr angezeigt.`,
      confirmLabel: 'Entfernen',
      destructive: true,
    };

    this.sheets
      .open<boolean, ConfirmationDialogData>(ConfirmationDialog, {
        heading: 'Kalender entfernen?',
        data,
      })
      .closed.subscribe((confirmed) => {
        if (confirmed !== true) {
          return;
        }

        void this.removeIcs(subscriptionId);
      });
  }

  private async removeIcs(subscriptionId: string): Promise<void> {
    const removed = await this.attempt(
      () => this.icsSubscriptions.remove(subscriptionId),
      'Der Kalender konnte nicht entfernt werden.',
    );
    if (removed) {
      this.announcer.announce('Kalender entfernt');
    }
  }

  /**
   * Runs one change and reloads the list either way, so it shows what is stored. A failure is shown
   * as an alert on the page instead of becoming an unhandled rejection. Resolves to whether the
   * change went through.
   */
  private async attempt(change: () => Promise<unknown>, failure: string): Promise<boolean> {
    this.actionError.set(null);
    try {
      await change();
      return true;
    } catch (error) {
      console.warn(failure, error);
      this.actionError.set(`${failure} Versuche es noch einmal.`);
      return false;
    } finally {
      this.icsResource.reload();
    }
  }
}
