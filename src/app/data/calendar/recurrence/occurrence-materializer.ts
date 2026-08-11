import { RRuleTemporal } from 'rrule-temporal';
import { Temporal } from 'temporal-polyfill';

import type { AppItemExceptionRecord, AppItemRecord } from '../../entities/app-item.record';
import type { CalendarSourceType } from '../../entities/calendar-source.record';
import type { OccurrenceRecord } from '../../entities/occurrence.record';
import type { TemporalValue } from '../../entities/temporal-value';
import { MAX_OCCURRENCES_PER_SERIES, MAX_RULE_ITERATIONS } from './materialization-config';
import { toUtcInstantString } from './rrule-tools';

/**
 * How the generated rows are branded. App items are the default; the ICS pipeline reuses the same
 * expansion by mapping its normalized items into the app-item shape and branding rows `ics:`.
 */
export interface SeriesBranding {
  readonly keyPrefix: 'app' | 'ics';
  readonly sourceType: CalendarSourceType;
}

const APP_BRANDING: SeriesBranding = { keyPrefix: 'app', sourceType: 'app' };

/**
 * Everything the expansion needs besides the item itself. `timeZone` is the device zone: it gives
 * `date` and `floating` values their concrete instants, which is legitimate for derived rows
 * because a zone change triggers a rebuild.
 */
export interface MaterializationContext {
  readonly sourceId: string;
  readonly windowStartUtc: string;
  readonly windowEndUtc: string;
  readonly timeZone: string;
  /** Overrides the per-series cap; only specs shrink it to make truncation testable. */
  readonly maxOccurrencesPerSeries?: number;
}

export interface MaterializationResult {
  readonly occurrences: readonly OccurrenceRecord[];
  /** True when the series hit the per-series cap and was cut off inside the window. */
  readonly truncated: boolean;
}

/**
 * Expands one canonical app item into its concrete occurrence rows for the window.
 *
 * The only place rrule-temporal is used. A standalone item becomes exactly one row; a recurring
 * master becomes one row per generated instance, with cancellations dropped and overrides applied
 * on top. The occurrence's identity (`originalStart`) is the generated start in the master's own
 * temporal kind; its effective time may differ when an override moved it.
 */
export function materializeAppItem(
  item: AppItemRecord,
  exceptions: readonly AppItemExceptionRecord[],
  context: MaterializationContext,
  branding: SeriesBranding = APP_BRANDING,
): MaterializationResult {
  if (item.rrule === null) {
    return { occurrences: [standaloneRow(item, context, branding)], truncated: false };
  }

  const rule = new RRuleTemporal({
    rruleString: `${dtstartLine(item.start)}\nRRULE:${item.rrule}`,
    tzid: expansionZone(item.start, context.timeZone),
    maxIterations: MAX_RULE_ITERATIONS,
    includeDtstart: true,
  });

  const generated = rule.between(
    new Date(context.windowStartUtc),
    new Date(context.windowEndUtc),
    true,
  );
  const cap = context.maxOccurrencesPerSeries ?? MAX_OCCURRENCES_PER_SERIES;
  const truncated = generated.length > cap;
  const bounded = truncated ? generated.slice(0, cap) : generated;

  const exceptionsByStart = new Map(exceptions.map((entry) => [entry.originalStart, entry]));
  const occurrences: OccurrenceRecord[] = [];
  const coveredOriginalStarts = new Set<string>();

  for (const zoned of bounded) {
    const originalStart = formatInKind(zoned, item.start);
    coveredOriginalStarts.add(originalStart);
    const exception = exceptionsByStart.get(originalStart);

    if (exception?.status === 'cancelled') {
      continue;
    }

    occurrences.push(generatedRow(item, originalStart, exception ?? null, context, branding));
  }

  // An override can move an occurrence into the window from an original start outside it (the
  // rule's raw generation above only sees originals inside the window). Without this, a moved
  // occurrence whose original start falls just before or after the covered range silently
  // disappears from the view even though the exception is authoritative data.
  for (const exception of exceptions) {
    if (
      exception.status !== 'override' ||
      exception.start === null ||
      coveredOriginalStarts.has(exception.originalStart)
    ) {
      continue;
    }

    const effectiveUtc = toUtcInstantString(exception.start, context.timeZone);
    if (effectiveUtc < context.windowStartUtc || effectiveUtc >= context.windowEndUtc) {
      continue;
    }

    if (ruleGeneratesOriginalStart(rule, item.start, exception.originalStart, context.timeZone)) {
      occurrences.push(generatedRow(item, exception.originalStart, exception, context, branding));
    }
  }

  return { occurrences, truncated };
}

/**
 * Whether the rule actually produces an occurrence at this exact original start — verified with a
 * one-second probe window around it rather than trusted blindly, so a stale exception left over
 * from a since-changed rule is not resurrected just because its override moved it into view.
 */
function ruleGeneratesOriginalStart(
  rule: RRuleTemporal,
  masterStart: TemporalValue,
  originalStart: string,
  deviceZone: string,
): boolean {
  const target: TemporalValue = {
    kind: masterStart.kind,
    value: originalStart,
    timeZone: masterStart.timeZone,
  };
  const targetMs = Date.parse(toUtcInstantString(target, deviceZone));
  const probe = rule.between(new Date(targetMs - 1000), new Date(targetMs + 1000), true);

  return probe.some((zoned) => formatInKind(zoned, masterStart) === originalStart);
}

function standaloneRow(
  item: AppItemRecord,
  context: MaterializationContext,
  branding: SeriesBranding,
): OccurrenceRecord {
  return buildRow({
    id: `${branding.keyPrefix}:${item.id}`,
    item,
    context,
    branding,
    seriesId: null,
    originalStart: null,
    provenance: 'standalone',
    start: item.start,
    end: item.end,
    overrides: null,
  });
}

function generatedRow(
  item: AppItemRecord,
  originalStart: string,
  exception: AppItemExceptionRecord | null,
  context: MaterializationContext,
  branding: SeriesBranding,
): OccurrenceRecord {
  const generatedStart: TemporalValue = {
    kind: item.start.kind,
    value: originalStart,
    timeZone: item.start.timeZone,
  };
  const start = exception?.start ?? generatedStart;
  // An explicit end wins; otherwise the master's duration is carried over to the (possibly moved)
  // start, so shifting an occurrence keeps its length.
  const end = exception?.end ?? shiftEnd(item.start, item.end, start, context.timeZone) ?? null;

  return buildRow({
    id: `${branding.keyPrefix}:${item.id}#${originalStart}`,
    item,
    context,
    branding,
    seriesId: item.id,
    originalStart,
    provenance: exception ? 'overridden' : 'generated',
    start,
    end,
    overrides: exception,
  });
}

interface RowInput {
  readonly id: string;
  readonly item: AppItemRecord;
  readonly context: MaterializationContext;
  readonly branding: SeriesBranding;
  readonly seriesId: string | null;
  readonly originalStart: string | null;
  readonly provenance: OccurrenceRecord['provenance'];
  readonly start: TemporalValue;
  readonly end: TemporalValue | null;
  readonly overrides: AppItemExceptionRecord | null;
}

function buildRow(input: RowInput): OccurrenceRecord {
  const { item, context, start, end } = input;
  const zone = context.timeZone;
  const startPoint = resolve(start, zone);
  const endPoint = end === null ? null : resolve(end, zone);
  const isAllDay = start.kind === 'date';

  // The end key is exclusive. An all-day end date is inclusive in the record (its last day), so the
  // exclusive instant is the midnight after it; a missing end is a zero-length point.
  const endUtcInstant =
    end === null
      ? isAllDay
        ? startPoint.zoned.add({ days: 1 }).toInstant()
        : startPoint.instant
      : isAllDay
        ? endPoint!.zoned.add({ days: 1 }).toInstant()
        : endPoint!.instant;

  const endLocalDay =
    end === null
      ? startPoint.localDay
      : isAllDay
        ? endPoint!.localDay
        : lastTouchedDay(startPoint, endPoint!, zone);

  return {
    id: input.id,
    sourceId: context.sourceId,
    sourceType: input.branding.sourceType,
    calendarId: item.calendarId,
    seriesId: input.seriesId,
    originalStart: input.originalStart,
    provenance: input.provenance,
    itemKind: item.kind,
    // The ICS pipeline reuses this materializer with a fabricated `AppItemRecord` shape (see
    // `icsItemAsSeries`) whose `id` is not a real app item — only genuine `app` rows carry identity.
    itemId: input.branding.sourceType === 'app' ? item.id : null,
    title: input.overrides?.title ?? item.title,
    location: input.overrides ? (input.overrides.location ?? item.location) : item.location,
    // Only device-cached rows carry a description (see `device-normalizer.ts`); app-owned items
    // keep their note on the canonical `app_items` record instead, and ICS description support is
    // out of scope here.
    description: null,
    isAllDay,
    start,
    end,
    startUtc: startPoint.instant.toString(),
    endUtc: endUtcInstant.toString(),
    startLocalDay: startPoint.localDay,
    endLocalDay,
    externalId: null,
  };
}

interface ResolvedPoint {
  readonly instant: Temporal.Instant;
  readonly zoned: Temporal.ZonedDateTime;
  readonly localDay: string;
}

/** Gives a temporal value its concrete instant and its day in the device zone. */
function resolve(value: TemporalValue, deviceZone: string): ResolvedPoint {
  const zoned = toZoned(value, deviceZone);
  return {
    instant: zoned.toInstant(),
    zoned,
    localDay: zoned.withTimeZone(deviceZone).toPlainDate().toString(),
  };
}

function toZoned(value: TemporalValue, deviceZone: string): Temporal.ZonedDateTime {
  switch (value.kind) {
    case 'date':
      return Temporal.PlainDate.from(value.value).toZonedDateTime(deviceZone);
    case 'zoned':
      return Temporal.PlainDateTime.from(value.value).toZonedDateTime(value.timeZone ?? deviceZone);
    case 'floating':
      return Temporal.PlainDateTime.from(value.value).toZonedDateTime(deviceZone);
    case 'utc':
      return Temporal.Instant.from(value.value).toZonedDateTimeISO('UTC');
  }
}

/**
 * A timed event that ends exactly at midnight has not touched the next day, so the last day is
 * taken one millisecond before the exclusive end.
 */
function lastTouchedDay(start: ResolvedPoint, end: ResolvedPoint, deviceZone: string): string {
  if (Temporal.Instant.compare(end.instant, start.instant) <= 0) {
    return start.localDay;
  }

  return end.instant
    .subtract({ milliseconds: 1 })
    .toZonedDateTimeISO(deviceZone)
    .toPlainDate()
    .toString();
}

/**
 * Carries the master's duration over to a (possibly moved) start — used here for overrides and by
 * the editing interactor when a continuation series starts at a new occurrence.
 */
export function shiftEnd(
  masterStart: TemporalValue,
  masterEnd: TemporalValue | null,
  newStart: TemporalValue,
  deviceZone: string,
): TemporalValue | null {
  if (masterEnd === null) {
    return null;
  }

  if (masterStart.kind === 'date') {
    const days = Temporal.PlainDate.from(masterStart.value).until(
      Temporal.PlainDate.from(masterEnd.value),
    ).days;
    return {
      kind: 'date',
      value: Temporal.PlainDate.from(newStart.value).add({ days }).toString(),
      timeZone: null,
    };
  }

  const duration = toZoned(masterStart, deviceZone)
    .toInstant()
    .until(toZoned(masterEnd, deviceZone).toInstant());
  const endZoned = toZoned(newStart, deviceZone).add(duration);

  switch (newStart.kind) {
    case 'zoned':
    case 'floating':
      return {
        kind: newStart.kind,
        value: endZoned.toPlainDateTime().toString(),
        timeZone: newStart.timeZone,
      };
    case 'utc':
      return { kind: 'utc', value: endZoned.toInstant().toString(), timeZone: null };
    case 'date':
      return { kind: 'date', value: endZoned.toPlainDate().toString(), timeZone: null };
  }
}

/** The generated instance formatted back into the master's own temporal kind — its identity. */
function formatInKind(zoned: Temporal.ZonedDateTime, masterStart: TemporalValue): string {
  switch (masterStart.kind) {
    case 'date':
      return zoned.toPlainDate().toString();
    case 'zoned':
    case 'floating':
      return zoned.toPlainDateTime().toString();
    case 'utc':
      return zoned.toInstant().toString();
  }
}

/** The DTSTART property for the engine, in the value's own RFC 5545 form. */
function dtstartLine(start: TemporalValue): string {
  switch (start.kind) {
    case 'date':
      return `DTSTART;VALUE=DATE:${compactDate(start.value)}`;
    case 'zoned':
      return `DTSTART;TZID=${start.timeZone}:${compactDateTime(start.value)}`;
    case 'floating':
      return `DTSTART:${compactDateTime(start.value)}`;
    case 'utc': {
      const instant = Temporal.Instant.from(start.value).toZonedDateTimeISO('UTC');
      return `DTSTART:${compactDateTime(instant.toPlainDateTime().toString())}Z`;
    }
  }
}

/** The zone the engine expands in: the value's own for `zoned`, otherwise the device's. */
function expansionZone(start: TemporalValue, deviceZone: string): string {
  switch (start.kind) {
    case 'zoned':
      return start.timeZone ?? deviceZone;
    case 'utc':
      return 'UTC';
    default:
      return deviceZone;
  }
}

function compactDate(value: string): string {
  return value.replaceAll('-', '');
}

function compactDateTime(value: string): string {
  const dateTime = Temporal.PlainDateTime.from(value);
  return dateTime.toString({ smallestUnit: 'second' }).replaceAll('-', '').replaceAll(':', '');
}
