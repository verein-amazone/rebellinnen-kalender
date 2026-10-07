import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/core';
import { Router } from '@angular/router';
import { LucideRotateCcw, LucideTrash2 } from '@lucide/angular';

import { IntroInteractor } from '@app/interactors/onboarding/intro.interactor';
import { AppDataInteractor } from '@app/interactors/settings/app-data.interactor';
import { SheetService } from '@app/view/components/sheet/sheet.service';
import {
  ConfirmationDialog,
  type ConfirmationDialogData,
} from '@app/view/dialogs/confirmation/confirmation.dialog';
import { FocusedScreenScaffold } from '@app/view/scaffolds/focused-screen/focused-screen.scaffold';

/**
 * Developer tooling, under Settings → Entwicklung: throws away everything the app has stored so a
 * first-run path can be walked again - the Tagesimpuls arrival animation, the empty collection, the
 * seeded calendars - or brings back just the first-launch introduction.
 *
 * The app is restarted afterwards rather than left running: the stores hold their state in signals
 * read once at construction, so a running app would keep showing what was just deleted.
 */
@Component({
  selector: 'app-settings-dev-tools',
  // Component hosts are unknown elements and therefore inline by default.
  host: { class: 'block' },
  imports: [FocusedScreenScaffold, LucideRotateCcw, LucideTrash2],
  templateUrl: './dev-tools.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DevToolsPage {
  private readonly appData = inject(AppDataInteractor);
  private readonly sheets = inject(SheetService);
  private readonly document = inject(DOCUMENT);
  private readonly intro = inject(IntroInteractor);
  private readonly router = inject(Router);

  protected readonly resetting = signal(false);

  /**
   * Forgets that the introduction was seen and how far it got, then goes to Heute, where it starts
   * over from the first step - exactly like a first launch, with everything else left as it is.
   */
  protected async replayIntro(): Promise<void> {
    this.intro.reset();
    await this.router.navigateByUrl('/today');
  }

  protected confirmReset(): void {
    const data: ConfirmationDialogData = {
      message:
        'Alle Termine, Erinnerungen, Lesezeichen, Kalender und Einstellungen werden gelöscht. Die App startet danach neu.',
      confirmLabel: 'Alles löschen',
      destructive: true,
    };

    this.sheets
      .open<boolean, ConfirmationDialogData>(ConfirmationDialog, {
        heading: 'App-Daten löschen?',
        data,
      })
      .closed.subscribe(async (confirmed) => {
        if (confirmed !== true) {
          return;
        }

        this.resetting.set(true);
        await this.appData.resetAppData();
        this.document.defaultView?.location.reload();
      });
  }
}
