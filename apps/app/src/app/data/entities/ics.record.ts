import type { AppItemExceptionStatus, AppItemKind } from './app-item.record';
import type { TemporalValue } from './temporal-value';

/**
 * One ICS subscription: authoritative configuration plus the retained snapshot of the last valid
 * download. `url` is sensitive - it may carry an access token - and must never appear in full in
 * logs or error state. The last successful document is retained in the table as well, so derived
 * data can be rebuilt offline, but it is not part of this record: it can be megabytes, and every
 * list and lookup of subscriptions would otherwise carry it over the bridge
 * (`IcsSubscriptionDao.findRawIcs` reads it on its own).
 */
export interface IcsSubscriptionRecord {
  readonly id: string;
  readonly url: string;
  readonly allowInsecure: boolean;
  readonly etag: string | null;
  readonly lastModified: string | null;
  /** When the feed last returned content that was stored as a new revision. */
  readonly lastSuccessAt: string | null;
  /**
   * When the subscription was last confirmed to be current - a stored revision *or* a `304 Not
   * Modified`. This is what the automatic refresh interval is measured against: a feed that only
   * ever answers 304 is being checked successfully, and must not count as perpetually due.
   */
  readonly lastCheckedAt: string | null;
  readonly lastAttemptAt: string | null;
  readonly lastError: string | null;
  readonly activeRevisionId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  /** The curated catalog entry this subscription was seeded from, or `null` for a user-added one. */
  readonly curatedId: string | null;
}

/** One normalized master of the active revision - read-only, replaced only by a valid revision. */
export interface IcsItemRecord {
  readonly subscriptionId: string;
  readonly uid: string;
  readonly revisionId: string;
  readonly kind: AppItemKind;
  readonly title: string;
  readonly location: string | null;
  readonly note: string | null;
  /** The event's `URL` - an `http(s)` address, else `null`. */
  readonly url: string | null;
  /**
   * The join link from `CONFERENCE` or a vendor property such as `X-GOOGLE-CONFERENCE` - an `https`
   * address, else `null`. Kept for the series as a whole: an override does not change it.
   */
  readonly conferenceUrl: string | null;
  readonly start: TemporalValue;
  readonly end: TemporalValue | null;
  readonly rrule: string | null;
  /**
   * Minutes before the start from the event's `VALARM`s, or `null` for none. Kept for the series as
   * a whole, like `conferenceUrl`.
   */
  readonly reminders: readonly number[] | null;
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
  /**
   * An override's own `VALARM`s in minutes before its start, or `null` for none - the occurrence
   * then keeps the series' reminders. Always `null` for a cancellation.
   */
  readonly reminders: readonly number[] | null;
}
