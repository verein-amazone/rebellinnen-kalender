import type { Migration } from './migration';

/**
 * Gives every user-created calendar a colour.
 *
 * „Mein Kalender“ and ICS subscriptions used to be created without one, and the week and month
 * grid only draws a dot for a calendar that has a colour - so on a fresh install the user's own
 * appointments showed no dot at all, while the identity editor pre-selected Rot as if it were
 * already set. New calendars now start with `DEFAULT_CALENDAR_COLOR`; this fills in the ones
 * created before that.
 *
 * The hex is a literal on purpose: it must stay what this migration wrote even if the default in
 * `interactors/calendar/calendar-colors.ts` changes later. Device calendars are left alone - their
 * colour is the operating system's - and curated subscriptions already carry their catalogue's.
 */
export const DEFAULT_CALENDAR_COLORS: Migration = {
  toVersion: 17,
  statements: [
    `UPDATE calendars
        SET color = '#E92F2A'
      WHERE color IS NULL
        AND source_id IN (SELECT id FROM calendar_sources WHERE type IN ('app', 'ics'));`,
  ],
};
