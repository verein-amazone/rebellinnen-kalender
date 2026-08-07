import type { AppItemExceptionStatus, AppItemKind } from './app-item.record';
import type { TemporalValue } from './temporal-value';

/**
 * One ICS subscription: authoritative configuration plus the retained snapshot of the last valid
 * download. `url` is sensitive — it may carry an access token — and must never appear in full in
 * logs or error state; `rawIcs` is the last successful document, kept so derived data can be
 * rebuilt offline.
 */
export interface IcsSubscriptionRecord {
  readonly id: string;
  readonly url: string;
  readonly allowInsecure: boolean;
  readonly etag: string | null;
  readonly lastModified: string | null;
  readonly lastSuccessAt: string | null;
  readonly lastAttemptAt: string | null;
  readonly lastError: string | null;
  readonly activeRevisionId: string | null;
  readonly rawIcs: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** One normalized master of the active revision — read-only, replaced only by a valid revision. */
export interface IcsItemRecord {
  readonly subscriptionId: string;
  readonly uid: string;
  readonly revisionId: string;
  readonly kind: AppItemKind;
  readonly title: string;
  readonly location: string | null;
  readonly note: string | null;
  readonly start: TemporalValue;
  readonly end: TemporalValue | null;
  readonly rrule: string | null;
}

/** An override (RECURRENCE-ID) or cancellation (EXDATE), keyed by the original start. */
export interface IcsItemExceptionRecord {
  readonly subscriptionId: string;
  readonly uid: string;
  readonly originalStart: string;
  readonly revisionId: string;
  readonly status: AppItemExceptionStatus;
  readonly title: string | null;
  readonly location: string | null;
  readonly note: string | null;
  readonly start: TemporalValue | null;
  readonly end: TemporalValue | null;
}
