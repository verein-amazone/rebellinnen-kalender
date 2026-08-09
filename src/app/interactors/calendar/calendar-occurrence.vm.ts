import type { TemporalValue } from '@app/data/entities/temporal-value';

/** What the occurrence's source allows — capabilities follow ownership, never per-row flags. */
export interface CalendarOccurrenceActions {
  readonly editableInApp: boolean;
  readonly deletableInApp: boolean;
  readonly editViaNativeCalendar: boolean;
}

/**
 * One concrete occurrence as a screen renders it. Views consume this — and only this — for every
 * calendar surface; recurrence, ICS and native-calendar mechanics stay below the interactor.
 */
export interface CalendarOccurrence {
  readonly id: string;
  readonly sourceId: string;
  readonly calendarId: string;
  /** Set for occurrences of a recurring series, together with the occurrence's original start. */
  readonly seriesId: string | null;
  readonly originalStart: string | null;
  /** The owning `AppItemRecord.id` for app-owned occurrences; `null` for device/ICS ones. */
  readonly itemId: string | null;
  /** The platform's own event id for device occurrences; `null` for app/ICS ones. */
  readonly externalId: string | null;
  readonly kind: 'event' | 'todo';
  readonly title: string;
  readonly location: string | null;
  readonly allDay: boolean;
  readonly start: TemporalValue;
  readonly end: TemporalValue | null;
  readonly startUtc: string;
  readonly endUtc: string;
  /** The device-zone days the occurrence touches — what day-based views bucket by. */
  readonly startDay: string;
  readonly endDay: string;
  readonly actions: CalendarOccurrenceActions;
  /** True when the source's last refresh failed or its access was lost; cached data is shown. */
  readonly stale: boolean;
  readonly sourceName: string;
  readonly calendarName: string;
  readonly calendarColor: string | null;
  readonly calendarEmoji: string | null;
}
