import type { Migration } from './migration';

/**
 * Gives device calendars the identity of the native account/source they came from (iCloud, a
 * Google account, Exchange, …) — `Calendar.source` on iOS, `Calendar.accountName` on Android
 * (`@ebarooni/capacitor-calendar` has no unified concept across the two). `NULL` for app and ICS
 * calendars, which have no native source at all, and for existing device rows until the next sync
 * repopulates them (see `CalendarRepository.replaceDeviceRange`).
 */
export const ADD_CALENDAR_NATIVE_SOURCE: Migration = {
  toVersion: 8,
  statements: [
    `ALTER TABLE calendars ADD COLUMN native_source_id TEXT;`,
    `ALTER TABLE calendars ADD COLUMN native_source_name TEXT;`,
  ],
};
