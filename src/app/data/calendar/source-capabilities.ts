import type { CalendarSourceType } from '../entities/calendar-source.record';

/**
 * What the app may do with an occurrence, derived from its source's ownership - never stored
 * per row, so the rules cannot drift apart from the data.
 */
export interface SourceCapabilities {
  /** App-owned items are edited and deleted inside the app. */
  readonly editableInApp: boolean;
  readonly deletableInApp: boolean;
  /** Writable device calendars are edited through the OS calendar flow, never in the app. */
  readonly editViaNativeCalendar: boolean;
}

/**
 * Capabilities follow ownership: the app owns its items, the OS owns device items, an ICS feed is
 * read-only. `calendarWritable` only matters for device calendars - a read-only device calendar
 * offers no action at all.
 */
export function capabilitiesFor(
  sourceType: CalendarSourceType,
  calendarWritable: boolean,
): SourceCapabilities {
  switch (sourceType) {
    case 'app':
      return { editableInApp: true, deletableInApp: true, editViaNativeCalendar: false };
    case 'device':
      return {
        editableInApp: false,
        deletableInApp: false,
        editViaNativeCalendar: calendarWritable,
      };
    case 'ics':
      return { editableInApp: false, deletableInApp: false, editViaNativeCalendar: false };
  }
}
