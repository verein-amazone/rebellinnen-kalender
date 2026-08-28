import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LucideChevronRight, LucideExternalLink } from '@lucide/angular';
import { RouterLink } from '@angular/router';

import { APP_VERSION } from '@app/cross-cutting/infrastructure/app-version';
import { DevicePlatformService } from '@app/cross-cutting/infrastructure/device-platform';
import { AppearanceInteractor } from '@app/interactors/settings/appearance.interactor';
import { FocusedScreenScaffold } from '@app/view/scaffolds/focused-screen/focused-screen.scaffold';

@Component({
  selector: 'app-settings-overview',
  // Component hosts are unknown elements and therefore inline by default.
  host: { class: 'block' },
  imports: [FocusedScreenScaffold, RouterLink, LucideChevronRight, LucideExternalLink],
  templateUrl: './overview.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsOverviewPage {
  protected readonly appearance = inject(AppearanceInteractor);

  /** Shown at the end of the list, so a support request can name the exact version. */
  protected readonly version = APP_VERSION;

  /** The home-screen icon is an OS concept; a browser tab has none to swap. */
  protected readonly isNativePlatform = inject(DevicePlatformService).platform !== 'web';
}
