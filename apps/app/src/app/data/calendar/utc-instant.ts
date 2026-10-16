import { Temporal } from 'temporal-polyfill';

/**
 * The one place an epoch-millisecond timestamp (from a Capacitor plugin or `Date`) becomes a UTC
 * instant string. Every occurrence-row UTC column is compared lexicographically, so every producer
 * must agree on precision: this always drops to whole seconds, matching `Temporal.Instant#toString()`
 * as used by the recurrence materializer and the range-query interactor. Without this, a device- or
 * ICS-sourced instant formatted via `Date#toISOString()` (`…T08:00:00.000Z`) sorts *before* the same
 * instant formatted by Temporal (`…T08:00:00Z`), because `'.' < 'Z'` - silently shifting half-open
 * range boundaries for those rows only.
 */
export function utcInstantFromEpochMilliseconds(epochMilliseconds: number): string {
  return Temporal.Instant.fromEpochMilliseconds(epochMilliseconds).toString({
    smallestUnit: 'second',
  });
}
