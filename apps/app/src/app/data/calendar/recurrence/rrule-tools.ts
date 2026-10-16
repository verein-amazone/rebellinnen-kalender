import ICAL from 'ical.js';
import { Temporal } from 'temporal-polyfill';

import type { TemporalValue } from '../../entities/temporal-value';

/**
 * The rule a „this and following“ continuation carries on with, given how many occurrences the
 * old series generated before the split. UNTIL is a fixed day and stays as it is; COUNT is the total
 * of the whole series, so the continuation only gets what is left of it - at least the split
 * occurrence itself, which exists, or there would be nothing to split at.
 */
export function continuedAfter(rrule: string, generatedBefore: number): string {
  const recur = ICAL.Recur.fromString(rrule);
  if (recur.count !== null) {
    recur.count = Math.max(1, recur.count - generatedBefore);
  }
  return recur.toString();
}

/**
 * Ends a rule just before the given occurrence, in the rule's own temporal kind - the
 * „this and following“ split truncates the old series with exactly this. Any COUNT is replaced: the
 * new UNTIL is the end now.
 *
 * UNTIL is written as a UTC instant for zoned starts (as RFC 5545 requires when DTSTART carries a
 * TZID) and as a local form for date and floating starts.
 */
export function truncatedBefore(
  rrule: string,
  masterStart: TemporalValue,
  splitOriginalStart: string,
): string {
  const recur = ICAL.Recur.fromString(rrule);
  recur.count = null;
  recur.until = ICAL.Time.fromString(untilValue(masterStart, splitOriginalStart), null);
  return recur.toString();
}

/** The UNTIL just before the split, as an ISO date, local date-time or UTC instant. */
function untilValue(masterStart: TemporalValue, splitOriginalStart: string): string {
  switch (masterStart.kind) {
    case 'date':
      return Temporal.PlainDate.from(splitOriginalStart).subtract({ days: 1 }).toString();
    case 'floating':
      return Temporal.PlainDateTime.from(splitOriginalStart)
        .subtract({ seconds: 1 })
        .toString({ smallestUnit: 'second' });
    case 'zoned':
      return Temporal.PlainDateTime.from(splitOriginalStart)
        .toZonedDateTime(masterStart.timeZone ?? 'UTC')
        .subtract({ seconds: 1 })
        .toInstant()
        .toString();
    case 'utc':
      return Temporal.Instant.from(splitOriginalStart).subtract({ seconds: 1 }).toString();
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
