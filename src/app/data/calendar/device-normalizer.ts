import { Temporal } from 'temporal-polyfill';

import type { OccurrenceRecord } from '../entities/occurrence.record';
import type { DeviceEventInstance } from '../gateways/native-calendar.gateway';

/** Deterministic row id for the calendar snapshot of one native calendar. */
export function deviceCalendarRowId(nativeCalendarId: string): string {
  return `device-cal:${nativeCalendarId}`;
}

/**
 * Translates concrete native instances into disposable occurrence rows.
 *
 * Identity is the source-scoped composite of platform, native calendar, native event id and the
 * instance start: iOS repeats one event id for every instance of a series, so the start is what
 * tells instances apart, and the platform prefix keeps identical ids from different worlds apart.
 * Cached rows are never editable app records — provenance is always `device-cached`.
 */
export function normalizeDeviceInstances(
  sourceId: string,
  platform: string,
  instances: readonly DeviceEventInstance[],
  timeZone: string,
): OccurrenceRecord[] {
  const rows = new Map<string, OccurrenceRecord>();

  for (const instance of instances) {
    if (instance.calendarId === null) {
      continue;
    }

    const id = `device:${platform}:${instance.calendarId}:${instance.eventId}#${instance.startUtc}`;
    // The platform can hand the same instance back twice at a range seam; last one wins.
    rows.set(id, toRow(id, sourceId, deviceCalendarRowId(instance.calendarId), instance, timeZone));
  }

  return [...rows.values()];
}

/**
 * The device-zone days a `[startUtc, endUtc)` interval touches — shared by normalization and by
 * the zone-change repair, which recomputes these columns for already-cached rows without a new
 * native query (the UTC instants stay valid; only their local-day bucketing changes).
 */
export function localDaysOf(
  startUtc: string,
  endUtc: string,
  timeZone: string,
): { startLocalDay: string; endLocalDay: string } {
  const startLocalDay = dayOf(startUtc, timeZone);
  // The end is exclusive; the last touched day sits one millisecond before it.
  const hasSpan = Date.parse(endUtc) > Date.parse(startUtc);
  const endLocalDay = hasSpan ? dayOf(beforeExclusiveEnd(endUtc), timeZone) : startLocalDay;

  return { startLocalDay, endLocalDay };
}

function toRow(
  id: string,
  sourceId: string,
  calendarRowId: string,
  instance: DeviceEventInstance,
  timeZone: string,
): OccurrenceRecord {
  const { startLocalDay: startDay, endLocalDay: endDay } = localDaysOf(
    instance.startUtc,
    instance.endUtc,
    timeZone,
  );

  return {
    id,
    sourceId,
    sourceType: 'device',
    calendarId: calendarRowId,
    seriesId: null,
    originalStart: null,
    provenance: 'device-cached',
    itemKind: 'event',
    title: instance.title,
    location: instance.location,
    isAllDay: instance.isAllDay,
    start: instance.isAllDay
      ? { kind: 'date', value: startDay, timeZone: null }
      : { kind: 'utc', value: instance.startUtc, timeZone: instance.timeZone },
    end: instance.isAllDay
      ? { kind: 'date', value: endDay, timeZone: null }
      : { kind: 'utc', value: instance.endUtc, timeZone: instance.timeZone },
    startUtc: instance.startUtc,
    endUtc: instance.endUtc,
    startLocalDay: startDay,
    endLocalDay: endDay,
    externalId: instance.eventId,
  };
}

function dayOf(instantIso: string, timeZone: string): string {
  return Temporal.Instant.from(instantIso).toZonedDateTimeISO(timeZone).toPlainDate().toString();
}

function beforeExclusiveEnd(instantIso: string): string {
  return Temporal.Instant.from(instantIso).subtract({ milliseconds: 1 }).toString();
}
