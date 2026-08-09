import { Temporal } from 'temporal-polyfill';

import type { TemporalValue } from '@app/data/entities/temporal-value';

/**
 * The device-local day (`YYYY-MM-DD`) a `TemporalValue` falls on, for callers that need to bucket or
 * navigate by day rather than render the full instant.
 *
 * - `'date'` already *is* a day, with no time or zone attached.
 * - `'zoned'` and `'floating'` carry a wall-clock date; for `'zoned'` that date is read directly
 *   rather than converted, since a wall-clock date does not change when re-expressed in another zone
 *   the way an instant would.
 * - `'utc'` is the one kind that needs an actual conversion, from the stored instant into the
 *   device's zone, before its date can be read.
 */
export function deviceLocalDay(value: TemporalValue): string {
  switch (value.kind) {
    case 'date':
      return value.value;
    case 'zoned':
    case 'floating':
      return value.value.slice(0, 10);
    case 'utc': {
      const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return Temporal.Instant.from(value.value)
        .toZonedDateTimeISO(deviceZone)
        .toPlainDate()
        .toString();
    }
  }
}
