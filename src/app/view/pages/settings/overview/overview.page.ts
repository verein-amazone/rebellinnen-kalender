import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LucideChevronRight, LucideExternalLink } from '@lucide/angular';
import { RouterLink } from '@angular/router';

import { APP_VERSION } from '@app/cross-cutting/infrastructure/app-version';
import { DEVELOPER_TOOLS_ENABLED } from '@app/cross-cutting/infrastructure/developer-tools';
import { DevicePlatformService } from '@app/cross-cutting/infrastructure/device-platform';
import { ImpulsePreferencesInteractor } from '@app/interactors/daily-content/impulse-preferences.interactor';
import { NotificationPreferencesInteractor } from '@app/interactors/notifications/notification-preferences.interactor';
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
  protected readonly impulse = inject(ImpulsePreferencesInteractor);
  private readonly notifications = inject(NotificationPreferencesInteractor);

  /** On the web there is nothing to switch, so the row says so rather than showing „Aus“. */
  protected readonly reminderStatus = computed(() => {
    if (!this.notifications.isSupported) {
      return 'Nur in der App';
    }
    return this.notifications.enabled() ? 'Ein' : 'Aus';
  });

  /** Shown at the end of the list, so a support request can name the exact version. */
  protected readonly version = APP_VERSION;

  /** Store builds hide the „Entwicklung“ section; see `DEVELOPER_TOOLS_ENABLED`. */
  protected readonly showDeveloperTools = inject(DEVELOPER_TOOLS_ENABLED);

  /** The home-screen icon is an OS concept; a browser tab has none to swap. */
  protected readonly isNativePlatform = inject(DevicePlatformService).platform !== 'web';
}
