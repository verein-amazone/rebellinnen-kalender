import { LiveAnnouncer } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, inject, resource } from '@angular/core';
import { LucideTrash2 } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';

import { IcsSubscriptionInteractor } from '@app/interactors/calendar/ics-subscription.interactor';
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
  imports: [FocusedScreenScaffold, CalendarAvatar, ToggleField, LucideTrash2],
  templateUrl: './ics-calendars.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IcsCalendarsPage {
  private readonly icsSubscriptions = inject(IcsSubscriptionInteractor);
  private readonly sheets = inject(SheetService);
  private readonly announcer = inject(LiveAnnouncer);

  protected readonly icsResource = resource({
    loader: () => this.icsSubscriptions.listForManagement(),
  });

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

    await this.icsSubscriptions.updateIdentity(subscriptionId, result);
    this.icsResource.reload();
    this.announcer.announce('Kalender gespeichert');
  }

  protected async toggleIcs(subscriptionId: string, enabled: boolean): Promise<void> {
    await this.icsSubscriptions.setEnabled(subscriptionId, enabled);
    this.icsResource.reload();
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
    await this.icsSubscriptions.remove(subscriptionId);
    this.icsResource.reload();
    this.announcer.announce('Kalender entfernt');
  }
}
