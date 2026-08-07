import type { TemporalValue } from './temporal-value';

export const APP_ITEM_KINDS = ['event', 'todo'] as const;
export type AppItemKind = (typeof APP_ITEM_KINDS)[number];

/**
 * One canonical app-owned calendar item as it is stored — a standalone event or todo, or the
 * master of a recurring series when `rrule` is set.
 *
 * `rrule` holds the RFC 5545 rule value (`FREQ=…`) verbatim; `start` is the series DTSTART.
 * `predecessorSeriesId` links a continuation series to the series it was split off from.
 * `ruleRevision` increments with every recurrence-pattern change.
 */
export interface AppItemRecord {
  readonly id: string;
  readonly calendarId: string;
  readonly kind: AppItemKind;
  readonly title: string;
  readonly location: string | null;
  readonly note: string | null;
  readonly start: TemporalValue;
  readonly end: TemporalValue | null;
  readonly rrule: string | null;
  readonly predecessorSeriesId: string | null;
  readonly ruleRevision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const APP_ITEM_EXCEPTION_STATUSES = ['override', 'cancelled'] as const;
export type AppItemExceptionStatus = (typeof APP_ITEM_EXCEPTION_STATUSES)[number];

/**
 * The deliberate difference of one occurrence of a series, keyed by the occurrence's **original**
 * start — its identity even after being moved. For an `override`, every `null` field inherits from
 * the master; for `cancelled`, the occurrence does not happen and the other fields are meaningless.
 */
export interface AppItemExceptionRecord {
  readonly seriesId: string;
  readonly originalStart: string;
  readonly status: AppItemExceptionStatus;
  readonly title: string | null;
  readonly location: string | null;
  readonly note: string | null;
  readonly start: TemporalValue | null;
  readonly end: TemporalValue | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
