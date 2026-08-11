import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject } from '@angular/core';
import { App as CapacitorApp } from '@capacitor/app';
import { RouterOutlet } from '@angular/router';

import { AppearanceInteractor } from '@app/interactors/settings/appearance.interactor';
import { DeviceCalendarSyncInteractor } from '@app/interactors/calendar/device-calendar-sync.interactor';
import { DocumentAppearance } from '@app/cross-cutting/infrastructure/document-appearance';
import { SystemTextScale } from '@app/cross-cutting/infrastructure/system-text-scale';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly appearance = inject(AppearanceInteractor);
  private readonly documentAppearance = inject(DocumentAppearance);
  private readonly systemTextScale = inject(SystemTextScale);
  private readonly deviceCalendarSync = inject(DeviceCalendarSyncInteractor);

  constructor() {
    // The selected appearance is applied in one place, for the whole app, whenever it changes. The
    // OS scale is part of it because it is what applies while the text size is left on `system`.
    effect(() => {
      this.documentAppearance.apply({
        theme: this.appearance.theme(),
        textSize: this.appearance.textSize(),
        motion: this.appearance.motion(),
        osTextScale: this.systemTextScale.scale(),
      });
    });

    // Mirrors `LocalDay`'s own `appStateChange` listener: a device calendar can change while the
    // app is backgrounded (an edit made in the OS calendar app itself, or synced in from Google/
    // iCloud in the background), and nothing else re-reads it on the way back in. `refresh()` is
    // debounced (not `force`), so a foreground within `DEVICE_REFRESH_MIN_INTERVAL_MS` of the last
    // check is a no-op.
    const listener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        void this.deviceCalendarSync.refresh();
      }
    });
    inject(DestroyRef).onDestroy(() => void listener.then((handle) => handle.remove()));
  }
}
