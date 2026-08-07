import { inject, Injectable } from '@angular/core';

import { CalendarRepository, type CalendarContext } from '@app/data/calendar/calendar.repository';
import { CalendarMaintenanceStore } from '@app/data/stores/calendar-maintenance.store';

/**
 * Keeps the derived occurrence rows consistent with the world they were computed in.
 *
 * Two things invalidate them wholesale: a device timezone change (`date` and `floating` rows carry
 * instants computed in the old zone) and a recurrence-engine upgrade (coverage rows are stamped
 * with the version that generated them). `ensureConsistency()` is cheap when nothing changed and
 * is meant to run on app start and on resume. Rebuilding never touches canonical app items or the
 * retained ICS data — that is the whole point of derived rows.
 */
@Injectable({ providedIn: 'root' })
export class CalendarMaintenanceInteractor {
  private readonly repository = inject(CalendarRepository);
  private readonly store = inject(CalendarMaintenanceStore);

  async ensureConsistency(): Promise<void> {
    const context = this.context();
    const zoneChanged =
      this.store.lastTimeZone() !== null && this.store.lastTimeZone() !== context.timeZone;
    const engineChanged = await this.repository.hasOutdatedEngineRows();

    if (zoneChanged || engineChanged) {
      await this.repository.rebuildAllDerived(context);
    }
    if (zoneChanged) {
      // rebuildAllDerived deliberately skips device sources — the cache can only be refilled by a
      // native query, which may be unavailable right now. Its local-day columns still need to
      // move to the new zone, and that much can be done locally from the stored UTC instants.
      await this.repository.recomputeDeviceLocalDays(context);
    }

    this.store.rememberTimeZone(context.timeZone);
  }

  /** The explicit repair command: rebuild everything derived, keep everything canonical. */
  async rebuildDerivedData(): Promise<void> {
    await this.repository.rebuildAllDerived(this.context());
  }

  private context(): CalendarContext {
    return {
      nowUtc: new Date().toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }
}
