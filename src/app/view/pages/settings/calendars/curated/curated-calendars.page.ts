import { LiveAnnouncer } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, inject, resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { CuratedCalendarsInteractor } from '@app/interactors/calendar/curated-calendars.interactor';
import { CalendarAvatar } from '@app/view/components/calendar-avatar/calendar-avatar';
import { ToggleField } from '@app/view/components/field/toggle-field';
import { SheetService } from '@app/view/components/sheet/sheet.service';
import {
  CalendarIdentityEditDialog,
  EMOJI_PICKER,
  type CalendarIdentityEditDialogData,
  type CalendarIdentityEditResult,
} from '@app/view/dialogs/calendar-identity-edit/calendar-identity-edit.dialog';
import { FocusedScreenScaffold } from '@app/view/scaffolds/focused-screen/focused-screen.scaffold';

/**
 * „Amazone & Partnerkalender“: the curated calendars shipped with the app (#2) - Amazone events,
 * partner organisations, Austrian public holidays. Mirrors `IcsCalendarsPage`, since a curated
 * source is a read-only ICS subscription underneath, minus the parts that don't apply to a fixed
 * list: no "add by link" and no delete, since the catalog - not the user - decides which sources
 * exist.
 *
 * Uses `resource()` and reloads after every write, per the frontend-architecture convention; there
 * is no persisted list cache here, matching `view/blocks/reminder-list/`.
 */
@Component({
  selector: 'app-settings-curated-calendars',
  // Component hosts are unknown elements and therefore inline by default.
  host: { class: 'block' },
  imports: [FocusedScreenScaffold, CalendarAvatar, ToggleField],
  templateUrl: './curated-calendars.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CuratedCalendarsPage {
  private readonly curated = inject(CuratedCalendarsInteractor);
  private readonly sheets = inject(SheetService);
  private readonly announcer = inject(LiveAnnouncer);

  protected readonly curatedResource = resource({
    loader: () => this.curated.listForManagement(),
  });

  protected async editCuratedIdentity(
    sourceId: string,
    current: CalendarIdentityEditDialogData,
  ): Promise<void> {
    const result = await firstValueFrom(
      this.sheets.open<CalendarIdentityEditResult, CalendarIdentityEditDialogData>(
        CalendarIdentityEditDialog,
        {
          heading: 'Kalender bearbeiten',
          mode: 'full',
          data: current,
          providers: [{ provide: EMOJI_PICKER, useValue: () => this.curated.pickEmoji() }],
        },
      ).closed,
    );
    if (result === undefined) {
      return;
    }

    await this.curated.updateIdentity(sourceId, result);
    this.curatedResource.reload();
    this.announcer.announce('Kalender gespeichert');
  }

  protected async toggleCurated(sourceId: string, enabled: boolean): Promise<void> {
    await this.curated.setEnabled(sourceId, enabled);
    this.curatedResource.reload();
  }

  protected async retryCurated(sourceId: string): Promise<void> {
    const outcome = await this.curated.refresh(sourceId, { force: true });
    this.curatedResource.reload();
    this.announcer.announce(
      outcome === 'failed' ? 'Aktualisierung fehlgeschlagen' : 'Kalender aktualisiert',
    );
  }
}
