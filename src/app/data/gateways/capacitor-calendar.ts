import { InjectionToken } from '@angular/core';
import { CapacitorCalendar } from '@ebarooni/capacitor-calendar';

/**
 * The calendar plugin behind a token, so the gateway spec can substitute a hand-written stub and
 * the plugin never has to exist under jsdom.
 */
export const CAPACITOR_CALENDAR = new InjectionToken<typeof CapacitorCalendar>(
  'CAPACITOR_CALENDAR',
  {
    providedIn: 'root',
    factory: () => CapacitorCalendar,
  },
);
