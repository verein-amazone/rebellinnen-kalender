import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  Injector,
} from '@angular/core';
import { App as CapacitorApp } from '@capacitor/app';
import { RouterOutlet } from '@angular/router';

import { AppearanceInteractor } from '@app/interactors/settings/appearance.interactor';
import { CalendarMaintenanceInteractor } from '@app/interactors/calendar/calendar-maintenance.interactor';
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
  private readonly calendarMaintenance = inject(CalendarMaintenanceInteractor);
  private readonly injector = inject(Injector);

  /** Guards the asynchronous refresh chain against resolving into a torn-down injector. */
  private destroyed = false;

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
    //
    // ICS subscriptions have no push notification of their own either, so the same foreground
    // event is what keeps them from silently going stale: `refreshAllDue()` only re-downloads a
    // subscription once its last success is older than `ICS_AUTO_REFRESH_MAX_AGE_MS`. Loaded
    // dynamically rather than injected as a field: the ICS pipeline (parsing, HTTP) is otherwise
    // only reachable through the lazy `calendar-routes` chunk, and a static import here would pull
    // all of it into the initial bundle that every route pays for on first load.
    const listener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        void this.refreshCalendars();
      }
    });
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      void listener.then((handle) => handle.remove());
    });

    // `appStateChange` only fires on the way back in, so the first run has to be started here.
    void this.refreshCalendars();
  }

  /**
   * Brings the calendar back in sync with the world it was computed in, then with its sources.
   *
   * Consistency comes first and is awaited: a device zone change or a recurrence-engine upgrade
   * invalidates the derived rows wholesale, and rebuilding them after a refresh had already written
   * into them would just do the work twice. It is cheap when nothing changed - two small reads.
   */
  private async refreshCalendars(): Promise<void> {
    try {
      await this.calendarMaintenance.ensureConsistency();
    } catch (error) {
      // A failed repair must not stop the refreshes below or escape into the app-state listener as
      // an unhandled rejection; the calendar screens surface their own load errors.
      console.warn('Die Kalenderdaten konnten nicht geprüft werden.', error);
    }

    // Every step past here is resolved asynchronously, so the app may be gone by the time it lands -
    // reaching into a destroyed injector then would throw where nobody can catch it.
    if (this.destroyed) {
      return;
    }

    void this.deviceCalendarSync.refresh();
    void import('@app/interactors/calendar/ics-subscription.interactor').then(
      ({ IcsSubscriptionInteractor }) =>
        this.destroyed ? undefined : this.injector.get(IcsSubscriptionInteractor).refreshAllDue(),
    );
  }
}
