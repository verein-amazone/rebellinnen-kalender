import { Temporal } from 'temporal-polyfill';

import type { TemporalValue } from '../../entities/temporal-value';

/**
 * Removes UNTIL and COUNT from a rule value. A continuation series starts over at the split
 * occurrence; carrying the old COUNT over would silently shorten it, so the bound is dropped
 * deliberately and the caller re-applies one when the user asked for it.
 */
export function withoutEndBound(rrule: string): string {
  return rrule
    .split(';')
    .filter((part) => !part.startsWith('UNTIL=') && !part.startsWith('COUNT='))
    .join(';');
}

/**
 * Ends a rule just before the given occurrence, in the rule's own temporal kind — the
 * „this and following“ split truncates the old series with exactly this.
 *
 * UNTIL is written as a UTC instant for zoned starts (as RFC 5545 requires when DTSTART carries a
 * TZID) and as a local form for date and floating starts.
 */
export function truncatedBefore(
  rrule: string,
  masterStart: TemporalValue,
  splitOriginalStart: string,
): string {
  return `${withoutEndBound(rrule)};UNTIL=${untilValue(masterStart, splitOriginalStart)}`;
}

function untilValue(masterStart: TemporalValue, splitOriginalStart: string): string {
  switch (masterStart.kind) {
    case 'date':
      return compact(Temporal.PlainDate.from(splitOriginalStart).subtract({ days: 1 }).toString());
    case 'floating':
      return compact(
        Temporal.PlainDateTime.from(splitOriginalStart)
          .subtract({ seconds: 1 })
          .toString({ smallestUnit: 'second' }),
      );
    case 'zoned': {
      const instant = Temporal.PlainDateTime.from(splitOriginalStart)
        .toZonedDateTime(masterStart.timeZone ?? 'UTC')
        .subtract({ seconds: 1 })
        .toInstant();
      return utcCompact(instant);
    }
    case 'utc':
      return utcCompact(Temporal.Instant.from(splitOriginalStart).subtract({ seconds: 1 }));
  }
}

/** The concrete UTC instant of a temporal value; `date` and `floating` resolve in the device zone. */
export function toUtcInstantString(value: TemporalValue, deviceZone: string): string {
  switch (value.kind) {
    case 'date':
      return Temporal.PlainDate.from(value.value)
        .toZonedDateTime(deviceZone)
        .toInstant()
        .toString();
    case 'zoned':
      return Temporal.PlainDateTime.from(value.value)
        .toZonedDateTime(value.timeZone ?? deviceZone)
        .toInstant()
        .toString();
    case 'floating':
      return Temporal.PlainDateTime.from(value.value)
        .toZonedDateTime(deviceZone)
        .toInstant()
        .toString();
    case 'utc':
      return Temporal.Instant.from(value.value).toString();
  }
}

function utcCompact(instant: Temporal.Instant): string {
  const wall = instant.toZonedDateTimeISO('UTC').toPlainDateTime();
  return `${compact(wall.toString({ smallestUnit: 'second' }))}Z`;
}

function compact(value: string): string {
  return value.replaceAll('-', '').replaceAll(':', '');
}
