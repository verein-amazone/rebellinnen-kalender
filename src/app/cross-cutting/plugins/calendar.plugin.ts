import { InjectionToken } from '@angular/core';
import { CapacitorCalendar } from '@ebarooni/capacitor-calendar';

/** The device-calendar plugin. See ./README.md for why it is behind a token. */
export const CAPACITOR_CALENDAR = new InjectionToken<typeof CapacitorCalendar>(
  'CAPACITOR_CALENDAR',
  {
    providedIn: 'root',
    factory: () => CapacitorCalendar,
  },
);

/**
 * The plugin's permission-scope enum. Re-exported rather than imported at the call site, so the
 * package still has exactly one import site in the app.
 */
export { CalendarPermissionScope } from '@ebarooni/capacitor-calendar';
