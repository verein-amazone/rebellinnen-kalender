import ICAL from 'ical.js';

import type { IcsItemExceptionRecord, IcsItemRecord } from '../../entities/ics.record';
import type { TemporalValue } from '../../entities/temporal-value';
import { utcInstantFromEpochMilliseconds } from '../utc-instant';

/**
 * Why a feed cannot be used at all - as opposed to a single component that is just skipped. A
 * stable code (rather than only the English message) is what lets a caller resolve this to a
 * translated, user-facing string later without parsing prose.
 */
export const ICS_PARSE_ERROR_CODES = ['unreadable', 'not-a-calendar', 'too-many-events'] as const;
export type IcsParseErrorCode = (typeof ICS_PARSE_ERROR_CODES)[number];

export class IcsParseError extends Error {
  readonly code: IcsParseErrorCode;

  constructor(code: IcsParseErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'IcsParseError';
    this.code = code;
  }
}

/** Guard against pathological feeds; a sane calendar stays far below this. */
export const MAX_ICS_EVENTS = 10_000;

export interface ParsedIcsCalendar {
  readonly items: readonly IcsItemRecord[];
  readonly exceptions: readonly IcsItemExceptionRecord[];
  /**
   * One entry per component that could not be normalized and was skipped instead of failing the
   * whole feed - surfaced so the caller can log or eventually show a "n entries could not be
   * read" notice, instead of silently losing data with no trace.
   */
  readonly warnings: readonly string[];
}

/**
 * Parses and normalizes one ICS document - the only importer of `ical.js`.
 *
 * Recurring masters keep their RRULE text verbatim; EXDATEs become cancellation exceptions and
 * VEVENTs with a RECURRENCE-ID become overrides, both keyed by the occurrence's original start.
 * Unsupported properties never invalidate an otherwise usable feed: unusable single components are
 * skipped (and reported in `warnings`), only a document that cannot be parsed as a calendar at all
 * is an error. Timezones with an unknown (non-IANA) TZID fall back to floating time rather than
 * failing the feed.
 */
export function parseIcsCalendar(
  text: string,
  subscriptionId: string,
  revisionId: string,
): ParsedIcsCalendar {
  let component: ICAL.Component;
  try {
    component = new ICAL.Component(ICAL.parse(text));
  } catch (cause) {
    throw new IcsParseError('unreadable', 'The calendar could not be read.', { cause });
  }

  if (component.name !== 'vcalendar') {
    throw new IcsParseError('not-a-calendar', 'The file is not a calendar.');
  }

  for (const timezone of component.getAllSubcomponents('vtimezone')) {
    try {
      ICAL.TimezoneService.register(new ICAL.Timezone(timezone));
    } catch {
      // A broken VTIMEZONE only affects events referencing it; they fall back to floating.
    }
  }

  const events = component.getAllSubcomponents('vevent');
  if (events.length > MAX_ICS_EVENTS) {
    throw new IcsParseError('too-many-events', 'The calendar has too many entries.');
  }

  const items = new Map<string, IcsItemRecord>();
  const exceptions: IcsItemExceptionRecord[] = [];
  const warnings: string[] = [];

  for (const vevent of events) {
    try {
      collectEvent(vevent, subscriptionId, revisionId, items, exceptions);
    } catch (cause) {
      warnings.push(describeSkippedEvent(vevent, cause));
    }
  }

  return {
    items: [...items.values()],
    // Only exceptions whose master exists are meaningful.
    exceptions: exceptions.filter((exception) => items.has(exception.uid)),
    warnings,
  };
}

function collectEvent(
  vevent: ICAL.Component,
  subscriptionId: string,
  revisionId: string,
  items: Map<string, IcsItemRecord>,
  exceptions: IcsItemExceptionRecord[],
): void {
  const event = new ICAL.Event(vevent);
  if (!event.uid || !event.startDate) {
    throw new Error('missing UID or DTSTART');
  }

  const start = toTemporal(event.startDate);
  const recurrenceId = event.recurrenceId ? toTemporal(event.recurrenceId) : null;

  if (recurrenceId !== null) {
    // An override of one occurrence of the (separately delivered) master.
    exceptions.push({
      subscriptionId,
      uid: event.uid,
      originalStart: recurrenceId.value,
      revisionId,
      status: 'override',
      title: event.summary ?? null,
      location: event.location ?? null,
      note: event.description ?? null,
      start,
      end: event.endDate ? toEndTemporal(event.endDate, start.kind === 'date') : null,
    });
    return;
  }

  items.set(event.uid, {
    subscriptionId,
    uid: event.uid,
    revisionId,
    kind: 'event',
    title: event.summary ?? '',
    location: event.location ?? null,
    note: event.description ?? null,
    start,
    end: event.endDate ? toEndTemporal(event.endDate, start.kind === 'date') : null,
    rrule: readRrule(vevent),
  });

  for (const property of vevent.getAllProperties('exdate')) {
    for (const value of property.getValues()) {
      const excluded = toTemporal(value as ICAL.Time);
      exceptions.push({
        subscriptionId,
        uid: event.uid,
        originalStart: excluded.value,
        revisionId,
        status: 'cancelled',
        title: null,
        location: null,
        note: null,
        start: null,
        end: null,
      });
    }
  }
}

/** A short, log-safe description of a skipped component - never the full event content. */
function describeSkippedEvent(vevent: ICAL.Component, cause: unknown): string {
  const uid = vevent.getFirstPropertyValue('uid');
  const reason = cause instanceof Error ? cause.message : String(cause);
  return uid
    ? `Skipped event ${String(uid)}: ${reason}`
    : `Skipped an event without a UID: ${reason}`;
}

function readRrule(vevent: ICAL.Component): string | null {
  const rule = vevent.getFirstPropertyValue('rrule');
  return rule === null ? null : String(rule);
}

/**
 * An ICAL time in the app's lossless temporal form. Times whose TZID the runtime does not know
 * become floating - showing the event at its wall time beats dropping it.
 */
function toTemporal(time: ICAL.Time): TemporalValue {
  if (time.isDate) {
    return { kind: 'date', value: plainDate(time), timeZone: null };
  }

  const zone = time.zone?.tzid ?? null;
  if (zone === 'UTC' || zone === 'Z') {
    return {
      kind: 'utc',
      value: utcInstantFromEpochMilliseconds(time.toUnixTime() * 1000),
      timeZone: null,
    };
  }
  if (zone === null || zone === 'floating' || !isUsableZone(zone)) {
    return { kind: 'floating', value: plainDateTime(time), timeZone: null };
  }

  return { kind: 'zoned', value: plainDateTime(time), timeZone: zone };
}

/** ICS DTEND is exclusive for dates; the app's date ends are inclusive last days. */
function toEndTemporal(time: ICAL.Time, allDay: boolean): TemporalValue {
  const end = toTemporal(time);
  if (!allDay || end.kind !== 'date') {
    return end;
  }

  const previousDay = time.clone();
  previousDay.day -= 1;
  return { kind: 'date', value: plainDate(previousDay), timeZone: null };
}

function isUsableZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

function plainDate(time: ICAL.Time): string {
  return `${String(time.year).padStart(4, '0')}-${String(time.month).padStart(2, '0')}-${String(
    time.day,
  ).padStart(2, '0')}`;
}

function plainDateTime(time: ICAL.Time): string {
  return `${plainDate(time)}T${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(
    2,
    '0',
  )}:${String(time.second).padStart(2, '0')}`;
}
