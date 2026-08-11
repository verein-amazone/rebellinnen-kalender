/** Where calendar data comes from: the app's own tables, the OS calendar store, or an ICS feed. */
export const CALENDAR_SOURCE_TYPES = ['app', 'device', 'ics'] as const;
export type CalendarSourceType = (typeof CALENDAR_SOURCE_TYPES)[number];

/**
 * Whether the source's data is trustworthy right now. `stale` and `error` keep showing the cached
 * data; `permission-lost` keeps the device cache but flags it until access is granted again.
 */
export const CALENDAR_SOURCE_STATES = ['ok', 'stale', 'error', 'permission-lost'] as const;
export type CalendarSourceState = (typeof CALENDAR_SOURCE_STATES)[number];

/** One calendar source as it is stored. Timestamps are UTC ISO-8601 strings. */
export interface CalendarSourceRecord {
  readonly id: string;
  readonly type: CalendarSourceType;
  readonly name: string;
  readonly enabled: boolean;
  readonly state: CalendarSourceState;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * One calendar inside a source. App calendars are authoritative; device calendars are a snapshot of
 * what the OS reported, with the platform's calendar id in `externalId`; an ICS subscription owns
 * exactly one calendar.
 */
export interface CalendarRecord {
  readonly id: string;
  readonly sourceId: string;
  readonly name: string;
  readonly color: string | null;
  readonly emoji: string | null;
  readonly enabled: boolean;
  /** Whether the underlying store accepts writes — always true for app, always false for ICS. */
  readonly writable: boolean;
  readonly externalId: string | null;
  /**
   * The native account/source this calendar belongs to on the device — `null` for app and ICS
   * calendars, which have no such concept. `nativeSourceId` is the grouping key (iOS: the native
   * `CalendarSource` id; Android has no separate id, so its account name doubles as both);
   * `nativeSourceName` is what a subheading shows for it.
   */
  readonly nativeSourceId: string | null;
  readonly nativeSourceName: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
