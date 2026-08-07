/**
 * The four ways RFC 5545 expresses a point in time. Keeping them distinguishable — instead of
 * flattening everything to UTC — is what lets a rule like „every day at 09:00 in Europe/Vienna“
 * survive a DST transition, and a date-only birthday stay a date.
 */
export const TEMPORAL_KINDS = ['date', 'zoned', 'floating', 'utc'] as const;
export type TemporalKind = (typeof TEMPORAL_KINDS)[number];

/**
 * One point in time, stored losslessly in its own kind:
 *
 * - `date` — `YYYY-MM-DD`, no time, no zone (all-day).
 * - `zoned` — `YYYY-MM-DDTHH:MM:SS` wall time plus an IANA zone in `timeZone`.
 * - `floating` — `YYYY-MM-DDTHH:MM:SS` wall time in whatever zone the device is in.
 * - `utc` — ISO-8601 UTC instant (`…Z`).
 *
 * `timeZone` is present exactly for `zoned` values.
 */
export interface TemporalValue {
  readonly kind: TemporalKind;
  readonly value: string;
  readonly timeZone: string | null;
}
