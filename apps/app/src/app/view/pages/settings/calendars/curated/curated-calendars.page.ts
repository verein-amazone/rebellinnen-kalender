import { LiveAnnouncer } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
import { LucideRotateCw } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';

import { DevicePlatformService } from '@app/cross-cutting/infrastructure/device-platform';
import { CuratedCalendarsInteractor } from '@app/interactors/calendar/curated-calendars.interactor';
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
import { FocusedScreenScaffold } from '@app/view/scaffolds/focused-screen/focused-screen.scaffold';
import { InfoToggletip } from '@app/view/components/info-toggletip/info-toggletip';

/**
 * „Rebell*innen & mehr“: the curated calendars shipped with the app (#2) - Amazone events,
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
  imports: [InfoToggletip, FocusedScreenScaffold, CalendarAvatar, ToggleField, LucideRotateCw],
  templateUrl: './curated-calendars.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CuratedCalendarsPage {
  private readonly curated = inject(CuratedCalendarsInteractor);

  /**
   * A curated source is an ICS subscription underneath and refreshes through `IcsHttpGateway`,
   * which only escapes CORS on a device - the catalog's own feeds send no
   * `Access-Control-Allow-Origin`. Same treatment as „Abonnierte Kalender“: hidden on the web,
   * explained when a link leads here anyway.
   */
  protected readonly isNativePlatform = inject(DevicePlatformService).platform !== 'web';
  private readonly sheets = inject(SheetService);
  private readonly announcer = inject(LiveAnnouncer);
  private readonly haptics = inject(HapticsInteractor);

  protected readonly curatedResource = resource({
    loader: () => this.curated.listForManagement(),
  });

  /** Why the last change on this page failed; cleared by the next one. */
  protected readonly actionError = signal<string | null>(null);

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

    const saved = await this.attempt(
      () => this.curated.updateIdentity(sourceId, result),
      'Der Kalender konnte nicht gespeichert werden.',
    );
    if (saved) {
      void this.haptics.confirm();
      this.announcer.announce('Kalender gespeichert');
    }
  }

  protected async toggleCurated(sourceId: string, enabled: boolean): Promise<void> {
    await this.attempt(
      () => this.curated.setEnabled(sourceId, enabled),
      enabled
        ? 'Der Kalender konnte nicht eingeschaltet werden.'
        : 'Der Kalender konnte nicht ausgeschaltet werden.',
    );
  }

  protected async retryCurated(sourceId: string): Promise<void> {
    const outcome = await this.curated.refresh(sourceId, { force: true });
    this.curatedResource.reload();
    this.announcer.announce(
      outcome === 'failed' ? 'Aktualisierung fehlgeschlagen' : 'Kalender aktualisiert',
    );
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
      this.curatedResource.reload();
    }
  }
}
