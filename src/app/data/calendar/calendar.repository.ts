import { inject, Injectable } from '@angular/core';
import { Temporal } from 'temporal-polyfill';

import { AppCalendarItemDao } from '../daos/app-calendar-item.dao';
import { CalendarSourceDao } from '../daos/calendar-source.dao';
import { OccurrenceDao } from '../daos/occurrence.dao';
import type { AppItemExceptionRecord, AppItemRecord } from '../entities/app-item.record';
import type {
  CalendarRecord,
  CalendarSourceRecord,
  CalendarSourceState,
} from '../entities/calendar-source.record';
import type { OccurrenceRecord, SourceCoverageRecord } from '../entities/occurrence.record';
import { SQLITE_DATABASE, type SqliteExecutor } from '../gateways/sqlite-database';
import {
  RECURRENCE_ENGINE_VERSION,
  WINDOW_EDGE_THRESHOLD_MONTHS,
  WINDOW_EXTENSION_MONTHS,
  WINDOW_FUTURE_MONTHS,
  WINDOW_PAST_MONTHS,
} from './recurrence/materialization-config';
import { IcsItemDao } from '../daos/ics-item.dao';
import { IcsSubscriptionDao } from '../daos/ics-subscription.dao';
import type {
  IcsItemExceptionRecord,
  IcsItemRecord,
  IcsSubscriptionRecord,
} from '../entities/ics.record';
import type { DeviceCalendar, DeviceEventInstance } from '../gateways/native-calendar.gateway';
import { deviceCalendarRowId, localDaysOf, normalizeDeviceInstances } from './device-normalizer';
import type { ParsedIcsCalendar } from './ics/ics-parser';
import { materializeAppItem } from './recurrence/occurrence-materializer';
import { toUtcInstantString, truncatedBefore } from './recurrence/rrule-tools';
import { capabilitiesFor, type SourceCapabilities } from './source-capabilities';

/**
 * What the interactor knows and the data layer must not decide: the clock and the device zone.
 * Interactors own „now“ by repository convention, the same way they own ids and timestamps.
 */
export interface CalendarContext {
  readonly nowUtc: string;
  readonly timeZone: string;
}

/** Optional narrowing of a range query; absent fields mean „everything visible“. */
export interface OccurrenceFilter {
  readonly sourceIds?: readonly string[];
  readonly calendarIds?: readonly string[];
}

/**
 * One occurrence as the unified range query returns it: the derived row joined with everything a
 * view needs to render it without knowing the source — calendar identity, capabilities derived
 * from ownership, and whether the source's data is currently trustworthy.
 */
export interface RangeOccurrence extends OccurrenceRecord {
  readonly capabilities: SourceCapabilities;
  readonly sourceState: CalendarSourceState;
  readonly sourceName: string;
  readonly calendarName: string;
  readonly calendarColor: string | null;
  readonly calendarEmoji: string | null;
}

/** The single calendar row an ICS subscription owns. */
export function icsCalendarRowId(subscriptionId: string): string {
  return `ics-cal:${subscriptionId}`;
}

/**
 * The application-facing boundary of the calendar data layer.
 *
 * Interactors call one repository method per unit of work and never touch the calendar DAOs
 * directly: every method that changes derived rows runs inside one transaction, so the UI can
 * never observe a half-replaced occurrence set. Coverage rows are written in the same transaction
 * as the rows they describe — coverage never claims data that did not commit.
 *
 * Introduced deliberately (architecture docs: repositories are not automatic): the calendar domain
 * coordinates several DAOs, a recurrence engine, the native calendar gateway and the ICS pipeline,
 * and that transaction choreography belongs in one place.
 */
@Injectable({ providedIn: 'root' })
export class CalendarRepository {
  private readonly database = inject(SQLITE_DATABASE);
  private readonly sources = inject(CalendarSourceDao);
  private readonly items = inject(AppCalendarItemDao);
  private readonly occurrences = inject(OccurrenceDao);
  private readonly icsSubscriptions = inject(IcsSubscriptionDao);
  private readonly icsItems = inject(IcsItemDao);

  /** Read access for interactors that need the canonical item before deciding an edit scope. */
  findItem(itemId: string): Promise<AppItemRecord | null> {
    return this.items.find(itemId);
  }

  /**
   * The unified range query every calendar view consumes. Returns the occurrences of all enabled
   * sources and calendars overlapping the half-open UTC range, deterministically ordered (day,
   * all-day first, start, title). Views get capabilities and staleness with each row and never
   * implement recurrence or provider logic themselves.
   */
  async occurrencesInRange(
    rangeStartUtc: string,
    rangeEndUtc: string,
    filter: OccurrenceFilter = {},
  ): Promise<RangeOccurrence[]> {
    const [rows, sources, calendars] = await Promise.all([
      this.occurrences.listInRange(rangeStartUtc, rangeEndUtc),
      this.sources.listSources(),
      this.sources.listCalendars(),
    ]);

    const sourceById = new Map(sources.map((source) => [source.id, source]));
    const calendarById = new Map(calendars.map((calendar) => [calendar.id, calendar]));
    const sourceFilter = filter.sourceIds === undefined ? null : new Set(filter.sourceIds);
    const calendarFilter = filter.calendarIds === undefined ? null : new Set(filter.calendarIds);

    const result: RangeOccurrence[] = [];
    for (const row of rows) {
      const source = sourceById.get(row.sourceId);
      const calendar = calendarById.get(row.calendarId);
      if (source === undefined || calendar === undefined) {
        // An orphaned derived row; the next rebuild sweeps it away.
        continue;
      }
      if (!source.enabled || !calendar.enabled) {
        continue;
      }
      if (sourceFilter !== null && !sourceFilter.has(source.id)) {
        continue;
      }
      if (calendarFilter !== null && !calendarFilter.has(calendar.id)) {
        continue;
      }

      result.push(this.toRangeOccurrence(row, source, calendar));
    }

    return result;
  }

  /**
   * One occurrence by id, joined the same way as `occurrencesInRange` — for a detail view opened
   * from a range list or a deep link. `null` when the row is gone or orphaned (its source or
   * calendar no longer exists); disabled sources/calendars are not filtered out here, unlike the
   * range query, since a detail view opened directly is not browsing a list of visible rows.
   */
  async occurrenceById(id: string): Promise<RangeOccurrence | null> {
    const row = await this.occurrences.findOne(id);
    if (row === null) {
      return null;
    }

    const [source, calendar] = await Promise.all([
      this.sources.findSource(row.sourceId),
      this.sources.findCalendar(row.calendarId),
    ]);
    if (source === null || calendar === null) {
      return null;
    }

    return this.toRangeOccurrence(row, source, calendar);
  }

  /** Joins a derived row with its source and calendar — the shape every calendar view consumes. */
  private toRangeOccurrence(
    row: OccurrenceRecord,
    source: CalendarSourceRecord,
    calendar: CalendarRecord,
  ): RangeOccurrence {
    return {
      ...row,
      capabilities: capabilitiesFor(source.type, calendar.writable),
      sourceState: source.state,
      sourceName: source.name,
      calendarName: calendar.name,
      calendarColor: calendar.color,
      calendarEmoji: calendar.emoji,
    };
  }

  /** Creates a standalone item or a new series and materializes it in one unit of work. */
  async createItem(record: AppItemRecord, context: CalendarContext): Promise<void> {
    await this.database.transaction(async (tx) => {
      await this.items.insert(record, tx);
      await this.rematerializeItemInTransaction(record, context, tx);
    });
  }

  /**
   * „All occurrences“ (or a standalone edit): rewrites the master and rebuilds its rows.
   * Exceptions whose original occurrence the changed rule no longer generates are dropped
   * deliberately — an override of a Tuesday cannot survive a series that now runs on Fridays.
   */
  async updateItem(record: AppItemRecord, context: CalendarContext): Promise<void> {
    await this.database.transaction(async (tx) => {
      await this.items.update(record, tx);
      await this.pruneIncompatibleExceptions(record, context, tx);
      await this.rematerializeItemInTransaction(record, context, tx);
    });
  }

  /**
   * „Only this occurrence“: stores the override or cancellation and rebuilds the series' rows.
   * The exception's original start stays the occurrence's identity; nothing is promoted to an
   * authoritative single event.
   */
  async applyException(record: AppItemExceptionRecord, context: CalendarContext): Promise<void> {
    await this.database.transaction(async (tx) => {
      const item = await this.items.find(record.seriesId, tx);
      if (item === null) {
        return;
      }

      await this.items.upsertException(record, tx);
      await this.rematerializeItemInTransaction(item, context, tx);
    });
  }

  /**
   * „This and following occurrences“, edit form: ends the old series just before the split and
   * creates a linked continuation. Exceptions at or after the split move to the continuation when
   * its rule still generates their original occurrence; the rest are dropped deliberately.
   */
  async splitSeries(
    seriesId: string,
    splitOriginalStart: string,
    continuation: AppItemRecord,
    context: CalendarContext,
  ): Promise<void> {
    await this.database.transaction(async (tx) => {
      const master = await this.items.find(seriesId, tx);
      if (master === null || master.rrule === null) {
        return;
      }

      const tail = (await this.items.listExceptionsOfSeries(seriesId, tx)).filter(
        (exception) => exception.originalStart >= splitOriginalStart,
      );

      const truncatedMaster: AppItemRecord = {
        ...master,
        rrule: truncatedBefore(master.rrule, master.start, splitOriginalStart),
        ruleRevision: master.ruleRevision + 1,
        updatedAt: context.nowUtc,
      };
      await this.items.update(truncatedMaster, tx);
      await this.items.deleteExceptionsFrom(seriesId, splitOriginalStart, tx);

      const linkedContinuation: AppItemRecord = {
        ...continuation,
        predecessorSeriesId: seriesId,
      };
      await this.items.insert(linkedContinuation, tx);

      const generated = await this.generatedStarts(linkedContinuation, context, tx);
      for (const exception of tail) {
        if (generated.has(exception.originalStart)) {
          await this.items.upsertException(
            { ...exception, seriesId: linkedContinuation.id, updatedAt: context.nowUtc },
            tx,
          );
        }
      }

      await this.rematerializeItemInTransaction(truncatedMaster, context, tx);
      await this.rematerializeItemInTransaction(linkedContinuation, context, tx);
    });
  }

  /**
   * „This and following occurrences“, delete form: ends the series just before the split and
   * removes the tail's exceptions and rows.
   */
  async deleteFollowing(
    seriesId: string,
    splitOriginalStart: string,
    context: CalendarContext,
  ): Promise<void> {
    await this.database.transaction(async (tx) => {
      const master = await this.items.find(seriesId, tx);
      if (master === null || master.rrule === null) {
        return;
      }

      const truncatedMaster: AppItemRecord = {
        ...master,
        rrule: truncatedBefore(master.rrule, master.start, splitOriginalStart),
        ruleRevision: master.ruleRevision + 1,
        updatedAt: context.nowUtc,
      };
      await this.items.update(truncatedMaster, tx);
      await this.items.deleteExceptionsFrom(seriesId, splitOriginalStart, tx);
      await this.rematerializeItemInTransaction(truncatedMaster, context, tx);
    });
  }

  /** Deletes a standalone item or an entire series: master, exceptions and derived rows. */
  async deleteItem(itemId: string): Promise<void> {
    await this.database.transaction(async (tx) => {
      await this.items.deleteExceptionsOfSeries(itemId, tx);
      await this.items.delete(itemId, tx);
      await this.occurrences.deleteOfSeries(itemId, tx);
      await this.occurrences.deleteOne(`app:${itemId}`, tx);
    });
  }

  /** Read access to a source, for interactors deciding whether to create or refresh one. */
  findSource(sourceId: string): Promise<CalendarSourceRecord | null> {
    return this.sources.findSource(sourceId);
  }

  /** Read access to a calendar together with its owning source, e.g. to branch on source type. */
  async findCalendarWithSource(
    calendarId: string,
  ): Promise<{ calendar: CalendarRecord; source: CalendarSourceRecord } | null> {
    const calendar = await this.sources.findCalendar(calendarId);
    if (calendar === null) {
      return null;
    }

    const source = await this.sources.findSource(calendar.sourceId);
    if (source === null) {
      return null;
    }

    return { calendar, source };
  }

  /** Read access to a source's calendars, for the management screen's device-calendar list. */
  listCalendarsOfSource(sourceId: string): Promise<CalendarRecord[]> {
    return this.sources.listCalendarsOfSource(sourceId);
  }

  /** Renames the app calendar or changes its colour/emoji identity. */
  async updateCalendarIdentity(
    calendarId: string,
    identity: { name: string; color: string | null; emoji: string | null },
    context: CalendarContext,
  ): Promise<void> {
    await this.sources.updateCalendarIdentity(
      calendarId,
      identity.name,
      identity.color,
      identity.emoji,
      context.nowUtc,
    );
  }

  /** Changes one calendar's emoji only — its name and colour are untouched. */
  async setCalendarEmoji(
    calendarId: string,
    emoji: string | null,
    context: CalendarContext,
  ): Promise<void> {
    await this.sources.updateCalendarEmoji(calendarId, emoji, context.nowUtc);
  }

  /**
   * Enables or disables one calendar. `occurrencesInRange` already filters on `calendar.enabled`,
   * so a disabled calendar's occurrences stop appearing without any further change.
   */
  async setCalendarEnabled(
    calendarId: string,
    enabled: boolean,
    context: CalendarContext,
  ): Promise<void> {
    await this.sources.updateCalendarEnabled(calendarId, enabled, context.nowUtc);
  }

  /**
   * Enables or disables every calendar of one source that shares a given native account/source
   * (`nativeSourceId`, `null` included) in one transaction — the management screen's per-account
   * "select all" toggle. The calendar source's own `enabled` flag is untouched.
   */
  async setCalendarsEnabledByNativeSource(
    sourceId: string,
    nativeSourceId: string | null,
    enabled: boolean,
    context: CalendarContext,
  ): Promise<void> {
    await this.database.transaction(async (tx) => {
      for (const calendar of await this.sources.listCalendarsOfSource(sourceId, tx)) {
        if (calendar.nativeSourceId === nativeSourceId) {
          await this.sources.updateCalendarEnabled(calendar.id, enabled, context.nowUtc, tx);
        }
      }
    });
  }

  /**
   * Opts out of the device source locally: it and its calendars stop being enabled, so their
   * occurrences disappear from every range query immediately. This does not and cannot revoke the
   * OS permission — only the OS settings can do that — so a later `connect()` re-enables it.
   */
  async disconnectDeviceSource(sourceId: string, context: CalendarContext): Promise<void> {
    await this.database.transaction(async (tx) => {
      await this.sources.updateSourceEnabled(sourceId, false, context.nowUtc, tx);
      for (const calendar of await this.sources.listCalendarsOfSource(sourceId, tx)) {
        await this.sources.updateCalendarEnabled(calendar.id, false, context.nowUtc, tx);
      }
    });
  }

  /** The mirror of `disconnectDeviceSource`, run when the user connects again. */
  async reconnectDeviceSource(sourceId: string, context: CalendarContext): Promise<void> {
    await this.database.transaction(async (tx) => {
      await this.sources.updateSourceEnabled(sourceId, true, context.nowUtc, tx);
      for (const calendar of await this.sources.listCalendarsOfSource(sourceId, tx)) {
        await this.sources.updateCalendarEnabled(calendar.id, true, context.nowUtc, tx);
      }
    });
  }

  /** Read access to a source's coverage, for interactors picking a refresh range. */
  findCoverage(sourceId: string): Promise<SourceCoverageRecord | null> {
    return this.occurrences.findCoverage(sourceId);
  }

  /** Creates a source with its calendars in one unit of work. */
  async createSource(
    source: CalendarSourceRecord,
    calendars: readonly CalendarRecord[],
  ): Promise<void> {
    await this.database.transaction(async (tx) => {
      await this.sources.insertSource(source, tx);
      for (const calendar of calendars) {
        await this.sources.insertCalendar(calendar, tx);
      }
    });
  }

  /** Marks a source's data quality without touching its rows — cached data stays visible. */
  async setSourceState(
    sourceId: string,
    state: CalendarSourceState,
    context: CalendarContext,
  ): Promise<void> {
    await this.sources.updateSourceState(sourceId, state, context.nowUtc);
  }

  /**
   * Replaces one device source's cache for a refreshed range in a single transaction: the calendar
   * snapshot is reconciled (removed native calendars take their rows with them), the range's rows
   * are swapped against the fresh instances, and coverage grows to include the range. The UI never
   * sees a half-replaced cache, and cached rows never become app-owned records.
   */
  async replaceDeviceRange(
    sourceId: string,
    platform: string,
    rangeStartUtc: string,
    rangeEndUtc: string,
    deviceCalendars: readonly DeviceCalendar[],
    instances: readonly DeviceEventInstance[],
    context: CalendarContext,
  ): Promise<void> {
    await this.database.transaction(async (tx) => {
      const existing = await this.sources.listCalendarsOfSource(sourceId, tx);
      const existingByRowId = new Map(existing.map((calendar) => [calendar.id, calendar]));
      const nativeRowIds = new Set(
        deviceCalendars.map((calendar) => deviceCalendarRowId(calendar.id)),
      );

      for (const calendar of deviceCalendars) {
        const rowId = deviceCalendarRowId(calendar.id);
        const known = existingByRowId.get(rowId);
        if (known === undefined) {
          await this.sources.insertCalendar(
            {
              id: rowId,
              sourceId,
              name: calendar.name,
              color: calendar.color,
              emoji: null,
              enabled: true,
              writable: calendar.writable,
              externalId: calendar.id,
              nativeSourceId: calendar.sourceId,
              nativeSourceName: calendar.sourceName,
              createdAt: context.nowUtc,
              updatedAt: context.nowUtc,
            },
            tx,
          );
        } else if (
          known.name !== calendar.name ||
          known.writable !== calendar.writable ||
          known.nativeSourceId !== calendar.sourceId ||
          known.nativeSourceName !== calendar.sourceName
        ) {
          await this.sources.updateCalendarSnapshot(
            rowId,
            calendar.name,
            calendar.writable,
            calendar.sourceId,
            calendar.sourceName,
            context.nowUtc,
            tx,
          );
        }
      }

      // A calendar removed on the device takes its snapshot row and cached occurrences with it.
      for (const calendar of existing) {
        if (!nativeRowIds.has(calendar.id)) {
          await this.occurrences.deleteByCalendar(calendar.id, tx);
          await this.sources.deleteCalendar(calendar.id, tx);
        }
      }

      await this.occurrences.deleteOfSourceInRange(sourceId, rangeStartUtc, rangeEndUtc, tx);
      await this.occurrences.insertMany(
        normalizeDeviceInstances(sourceId, platform, instances, context.timeZone),
        tx,
      );

      const coverage = await this.occurrences.findCoverage(sourceId, tx);
      await this.occurrences.upsertCoverage(
        {
          sourceId,
          windowStartUtc:
            coverage !== null && coverage.windowStartUtc < rangeStartUtc
              ? coverage.windowStartUtc
              : rangeStartUtc,
          windowEndUtc:
            coverage !== null && coverage.windowEndUtc > rangeEndUtc
              ? coverage.windowEndUtc
              : rangeEndUtc,
          engineVersion: RECURRENCE_ENGINE_VERSION,
          updatedAt: context.nowUtc,
        },
        tx,
      );

      await this.sources.updateSourceState(sourceId, 'ok', context.nowUtc, tx);
    });
  }

  findIcsSubscription(subscriptionId: string): Promise<IcsSubscriptionRecord | null> {
    return this.icsSubscriptions.find(subscriptionId);
  }

  listIcsSubscriptions(): Promise<IcsSubscriptionRecord[]> {
    return this.icsSubscriptions.list();
  }

  /**
   * Enables or disables an ICS subscription: its source and its single calendar together, since
   * `occurrencesInRange`/the source filters gate on both.
   */
  async setIcsSubscriptionEnabled(
    subscriptionId: string,
    enabled: boolean,
    context: CalendarContext,
  ): Promise<void> {
    await this.database.transaction(async (tx) => {
      await this.sources.updateSourceEnabled(subscriptionId, enabled, context.nowUtc, tx);
      await this.sources.updateCalendarEnabled(
        icsCalendarRowId(subscriptionId),
        enabled,
        context.nowUtc,
        tx,
      );
    });
  }

  /** Creates the source, its single calendar and the subscription row in one unit of work. */
  async createIcsSubscription(
    source: CalendarSourceRecord,
    calendar: CalendarRecord,
    subscription: IcsSubscriptionRecord,
  ): Promise<void> {
    await this.database.transaction(async (tx) => {
      await this.sources.insertSource(source, tx);
      await this.sources.insertCalendar(calendar, tx);
      await this.icsSubscriptions.insert(subscription, tx);
    });
  }

  /**
   * Activates a fully validated new revision in one transaction: the previous normalized items,
   * exceptions and derived rows are replaced, the raw document and HTTP cache metadata stored, and
   * the source goes back to `ok`. Nothing here runs unless download, parse and normalization all
   * succeeded — a failed refresh can never reach this method, which is what preserves the last
   * valid offline copy.
   */
  async activateIcsRevision(
    subscriptionId: string,
    revisionId: string,
    parsed: ParsedIcsCalendar,
    rawIcs: string,
    etag: string | null,
    lastModified: string | null,
    context: CalendarContext,
  ): Promise<void> {
    await this.database.transaction(async (tx) => {
      await this.icsItems.deleteOfSubscription(subscriptionId, tx);
      for (const item of parsed.items) {
        await this.icsItems.insertItem(item, tx);
      }
      for (const exception of parsed.exceptions) {
        await this.icsItems.insertException(exception, tx);
      }

      const truncated = await this.materializeIcsInTransaction(
        subscriptionId,
        parsed.items,
        parsed.exceptions,
        context,
        tx,
      );

      await this.icsSubscriptions.recordSuccess(
        subscriptionId,
        revisionId,
        rawIcs,
        etag,
        lastModified,
        context.nowUtc,
        tx,
      );
      await this.sources.updateSourceState(
        subscriptionId,
        truncated ? 'stale' : 'ok',
        context.nowUtc,
        tx,
      );
    });
  }

  /** An unchanged feed: only the attempt bookkeeping moves; the revision stays active. */
  async recordIcsNotModified(subscriptionId: string, context: CalendarContext): Promise<void> {
    await this.database.transaction(async (tx) => {
      await this.icsSubscriptions.recordNotModified(subscriptionId, context.nowUtc, tx);
      await this.sources.updateSourceState(subscriptionId, 'ok', context.nowUtc, tx);
    });
  }

  /**
   * A failed refresh: the previous revision and its rows stay fully usable. The source shows
   * `stale` when there is an older successful download, `error` when there never was one.
   */
  async recordIcsFailure(
    subscriptionId: string,
    error: string,
    context: CalendarContext,
  ): Promise<void> {
    await this.database.transaction(async (tx) => {
      const subscription = await this.icsSubscriptions.find(subscriptionId, tx);
      if (subscription === null) {
        return;
      }

      await this.icsSubscriptions.recordFailure(subscriptionId, error, context.nowUtc, tx);
      await this.sources.updateSourceState(
        subscriptionId,
        subscription.lastSuccessAt === null ? 'error' : 'stale',
        context.nowUtc,
        tx,
      );
    });
  }

  /**
   * Rebuilds one ICS source's derived rows from its retained normalized items, inside the given
   * window when one is supplied (so a coverage extension and its rows commit together) or the
   * source's current coverage otherwise.
   */
  async rematerializeIcsSource(
    subscriptionId: string,
    context: CalendarContext,
    windowOverride?: { startUtc: string; endUtc: string },
  ): Promise<void> {
    await this.database.transaction(async (tx) => {
      const items = await this.icsItems.listItems(subscriptionId, tx);
      const exceptions: IcsItemExceptionRecord[] = [];
      for (const item of items) {
        exceptions.push(...(await this.icsItems.listExceptions(subscriptionId, item.uid, tx)));
      }

      await this.materializeIcsInTransaction(
        subscriptionId,
        items,
        exceptions,
        context,
        tx,
        windowOverride,
      );
    });
  }

  /**
   * Widens the materialization window when a queried range approaches a coverage edge, and
   * rebuilds the affected app and ICS sources into the wider window from their retained canonical
   * or normalized data — no re-download. Device coverage is not touched here: only a native
   * refresh can fill it. Cheap when nothing is near an edge (one coverage read per source).
   */
  async extendCoverageForRange(
    rangeStartUtc: string,
    rangeEndUtc: string,
    context: CalendarContext,
  ): Promise<void> {
    for (const source of await this.sources.listSources()) {
      if (source.type === 'device') {
        continue;
      }

      const coverage = await this.occurrences.findCoverage(source.id);
      if (coverage === null) {
        continue;
      }

      const threshold = { months: WINDOW_EDGE_THRESHOLD_MONTHS };
      const zonedStart = Temporal.Instant.from(coverage.windowStartUtc).toZonedDateTimeISO(
        context.timeZone,
      );
      const zonedEnd = Temporal.Instant.from(coverage.windowEndUtc).toZonedDateTimeISO(
        context.timeZone,
      );

      const needsEarlier = rangeStartUtc < zonedStart.add(threshold).toInstant().toString();
      const needsLater = rangeEndUtc > zonedEnd.subtract(threshold).toInstant().toString();
      if (!needsEarlier && !needsLater) {
        continue;
      }

      const window = {
        startUtc: needsEarlier
          ? zonedStart.subtract({ months: WINDOW_EXTENSION_MONTHS }).toInstant().toString()
          : coverage.windowStartUtc,
        endUtc: needsLater
          ? zonedEnd.add({ months: WINDOW_EXTENSION_MONTHS }).toInstant().toString()
          : coverage.windowEndUtc,
      };

      // The widened window and the rows it materializes must commit together — otherwise an
      // interruption between two separate transactions could leave coverage permanently claiming
      // a span with no rows in it, and nothing would ever notice or repair that.
      if (source.type === 'app') {
        await this.rematerializeAppSource(source.id, context, window);
      } else {
        await this.rematerializeIcsSource(source.id, context, window);
      }
    }
  }

  /**
   * Deletes and rebuilds every derived row that can be rebuilt locally: app sources from their
   * canonical items, ICS sources from their retained normalized data. The device cache is left
   * alone — it can only be refilled by the native provider, and offline it is all there is.
   * Canonical data is never touched (the repair path after engine upgrades or zone changes).
   */
  async rebuildAllDerived(context: CalendarContext): Promise<void> {
    for (const source of await this.sources.listSources()) {
      if (source.type === 'app') {
        await this.rematerializeAppSource(source.id, context);
      } else if (source.type === 'ics') {
        await this.rematerializeIcsSource(source.id, context);
      }
    }
  }

  /**
   * Repairs the cached device rows' local-day columns after a device timezone change. The
   * underlying `start_utc`/`end_utc` are still correct absolute instants; only which device-zone
   * day they land on changes, so this recomputes locally instead of requiring a native refresh —
   * which may not even be possible offline or with permission lost.
   */
  async recomputeDeviceLocalDays(context: CalendarContext): Promise<void> {
    const rows = await this.occurrences.listOfSourceType('device');
    if (rows.length === 0) {
      return;
    }

    await this.database.transaction(async (tx) => {
      for (const row of rows) {
        const { startLocalDay, endLocalDay } = localDaysOf(
          row.startUtc,
          row.endUtc,
          context.timeZone,
        );
        if (startLocalDay !== row.startLocalDay || endLocalDay !== row.endLocalDay) {
          await this.occurrences.updateLocalDays(row.id, startLocalDay, endLocalDay, tx);
        }
      }
    });
  }

  /** True when any coverage row was generated by a different recurrence-engine version. */
  async hasOutdatedEngineRows(): Promise<boolean> {
    for (const source of await this.sources.listSources()) {
      if (source.type === 'device') {
        continue;
      }

      const coverage = await this.occurrences.findCoverage(source.id);
      if (coverage !== null && coverage.engineVersion !== RECURRENCE_ENGINE_VERSION) {
        return true;
      }
    }

    return false;
  }

  /** Removes a subscription and everything it brought along, in one unit of work. */
  async removeIcsSubscription(subscriptionId: string): Promise<void> {
    await this.database.transaction(async (tx) => {
      await this.occurrences.deleteOfSource(subscriptionId, tx);
      await this.occurrences.deleteCoverage(subscriptionId, tx);
      await this.icsItems.deleteOfSubscription(subscriptionId, tx);
      await this.icsSubscriptions.delete(subscriptionId, tx);
      await this.sources.deleteCalendarsOfSource(subscriptionId, tx);
      await this.sources.deleteSource(subscriptionId, tx);
    });
  }

  private async materializeIcsInTransaction(
    subscriptionId: string,
    items: readonly IcsItemRecord[],
    exceptions: readonly IcsItemExceptionRecord[],
    context: CalendarContext,
    tx: SqliteExecutor,
    windowOverride?: { startUtc: string; endUtc: string },
  ): Promise<boolean> {
    await this.occurrences.deleteOfSource(subscriptionId, tx);

    const window =
      windowOverride ??
      this.coverageWindow(await this.occurrences.findCoverage(subscriptionId, tx), context);
    const exceptionsByUid = new Map<string, IcsItemExceptionRecord[]>();
    for (const exception of exceptions) {
      const list = exceptionsByUid.get(exception.uid) ?? [];
      list.push(exception);
      exceptionsByUid.set(exception.uid, list);
    }

    let truncated = false;
    for (const item of items) {
      const result = materializeAppItem(
        icsItemAsSeries(item),
        (exceptionsByUid.get(item.uid) ?? []).map(icsExceptionAsSeriesException),
        {
          sourceId: subscriptionId,
          windowStartUtc: window.startUtc,
          windowEndUtc: window.endUtc,
          timeZone: context.timeZone,
        },
        { keyPrefix: 'ics', sourceType: 'ics' },
      );
      await this.occurrences.insertMany(result.occurrences, tx);
      truncated ||= result.truncated;
    }

    await this.occurrences.upsertCoverage(this.coverageRecord(subscriptionId, window, context), tx);

    return truncated;
  }

  /**
   * Replaces the derived rows of one app item — standalone or series — inside the source's
   * covered window. Called after every write to the item or its exceptions.
   */
  async rematerializeItem(itemId: string, context: CalendarContext): Promise<void> {
    await this.database.transaction(async (tx) => {
      const item = await this.items.find(itemId, tx);
      if (item === null) {
        // The item is gone; make sure its derived rows are too.
        await this.occurrences.deleteOfSeries(itemId, tx);
        await this.occurrences.deleteOne(`app:${itemId}`, tx);
        return;
      }

      await this.rematerializeItemInTransaction(item, context, tx);
    });
  }

  /**
   * Rebuilds every derived row of one app source from its canonical items, inside the given
   * window when one is supplied (e.g. by `extendCoverageForRange`, so the widened coverage and the
   * rows it describes commit together) or the source's current coverage otherwise.
   */
  async rematerializeAppSource(
    sourceId: string,
    context: CalendarContext,
    windowOverride?: { startUtc: string; endUtc: string },
  ): Promise<void> {
    await this.database.transaction(async (tx) => {
      await this.occurrences.deleteOfSource(sourceId, tx);

      const window =
        windowOverride ??
        this.coverageWindow(await this.occurrences.findCoverage(sourceId, tx), context);
      const calendarIds = new Set(
        (await this.sources.listCalendarsOfSource(sourceId, tx)).map((calendar) => calendar.id),
      );
      const items = (await this.items.listAll(tx)).filter((item) =>
        calendarIds.has(item.calendarId),
      );

      let truncated = false;
      for (const item of items) {
        const exceptions = await this.items.listExceptionsOfSeries(item.id, tx);
        const result = materializeAppItem(item, exceptions, {
          sourceId,
          windowStartUtc: window.startUtc,
          windowEndUtc: window.endUtc,
          timeZone: context.timeZone,
        });
        await this.occurrences.insertMany(result.occurrences, tx);
        truncated ||= result.truncated;
      }

      await this.occurrences.upsertCoverage(this.coverageRecord(sourceId, window, context), tx);

      if (truncated) {
        await this.sources.updateSourceState(sourceId, 'stale', context.nowUtc, tx);
      }
    });
  }

  private async rematerializeItemInTransaction(
    item: AppItemRecord,
    context: CalendarContext,
    tx: SqliteExecutor,
  ): Promise<void> {
    // Both shapes are cleared: the item may have changed between standalone and recurring.
    await this.occurrences.deleteOfSeries(item.id, tx);
    await this.occurrences.deleteOne(`app:${item.id}`, tx);

    const calendar = await this.sources.findCalendar(item.calendarId, tx);
    if (calendar === null) {
      return;
    }

    const coverage = await this.occurrences.findCoverage(calendar.sourceId, tx);
    const window = this.coverageWindow(coverage, context);
    const exceptions = await this.items.listExceptionsOfSeries(item.id, tx);

    const result = materializeAppItem(item, exceptions, {
      sourceId: calendar.sourceId,
      windowStartUtc: window.startUtc,
      windowEndUtc: window.endUtc,
      timeZone: context.timeZone,
    });
    await this.occurrences.insertMany(result.occurrences, tx);
    await this.occurrences.upsertCoverage(
      this.coverageRecord(calendar.sourceId, window, context),
      tx,
    );

    if (result.truncated) {
      await this.sources.updateSourceState(calendar.sourceId, 'stale', context.nowUtc, tx);
    }
  }

  /**
   * Drops exceptions the changed rule can no longer anchor. Only original starts inside the
   * covered window can be verified against the generated set; anything outside it is kept — it
   * will be judged when the window reaches it.
   */
  private async pruneIncompatibleExceptions(
    item: AppItemRecord,
    context: CalendarContext,
    tx: SqliteExecutor,
  ): Promise<void> {
    const exceptions = await this.items.listExceptionsOfSeries(item.id, tx);
    if (exceptions.length === 0) {
      return;
    }

    if (item.rrule === null) {
      await this.items.deleteExceptionsOfSeries(item.id, tx);
      return;
    }

    const generated = await this.generatedStarts(item, context, tx);
    const window = await this.windowOfItem(item, context, tx);

    for (const exception of exceptions) {
      const instant = toUtcInstantString(
        { kind: item.start.kind, value: exception.originalStart, timeZone: item.start.timeZone },
        context.timeZone,
      );
      const insideWindow = instant >= window.startUtc && instant < window.endUtc;

      if (insideWindow && !generated.has(exception.originalStart)) {
        await this.items.deleteException(item.id, exception.originalStart, tx);
      }
    }
  }

  /** The original starts the item's rule generates inside its source's covered window. */
  private async generatedStarts(
    item: AppItemRecord,
    context: CalendarContext,
    tx: SqliteExecutor,
  ): Promise<Set<string>> {
    if (item.rrule === null) {
      return new Set();
    }

    const window = await this.windowOfItem(item, context, tx);
    const result = materializeAppItem(item, [], {
      sourceId: 'probe',
      windowStartUtc: window.startUtc,
      windowEndUtc: window.endUtc,
      timeZone: context.timeZone,
    });

    return new Set(
      result.occurrences
        .map((occurrence) => occurrence.originalStart)
        .filter((start): start is string => start !== null),
    );
  }

  private async windowOfItem(
    item: AppItemRecord,
    context: CalendarContext,
    tx: SqliteExecutor,
  ): Promise<{ startUtc: string; endUtc: string }> {
    const calendar = await this.sources.findCalendar(item.calendarId, tx);
    const coverage =
      calendar === null ? null : await this.occurrences.findCoverage(calendar.sourceId, tx);
    return this.coverageWindow(coverage, context);
  }

  /** The existing coverage window, or the default window around „now“ for a first build. */
  private coverageWindow(
    coverage: SourceCoverageRecord | null,
    context: CalendarContext,
  ): { startUtc: string; endUtc: string } {
    if (coverage !== null) {
      return { startUtc: coverage.windowStartUtc, endUtc: coverage.windowEndUtc };
    }

    const now = Temporal.Instant.from(context.nowUtc).toZonedDateTimeISO(context.timeZone);
    return {
      startUtc: now.subtract({ months: WINDOW_PAST_MONTHS }).toInstant().toString(),
      endUtc: now.add({ months: WINDOW_FUTURE_MONTHS }).toInstant().toString(),
    };
  }

  private coverageRecord(
    sourceId: string,
    window: { startUtc: string; endUtc: string },
    context: CalendarContext,
  ): SourceCoverageRecord {
    return {
      sourceId,
      windowStartUtc: window.startUtc,
      windowEndUtc: window.endUtc,
      engineVersion: RECURRENCE_ENGINE_VERSION,
      updatedAt: context.nowUtc,
    };
  }
}

/**
 * A normalized ICS master in the shape the shared materializer expands. The fabricated series id
 * `<subscription>:<uid>` plus the `ics:` branding yields exactly the planned occurrence identity
 * `ics:<subscription>:<uid>#<recurrenceId>`.
 */
function icsItemAsSeries(item: IcsItemRecord): AppItemRecord {
  return {
    id: `${item.subscriptionId}:${item.uid}`,
    calendarId: icsCalendarRowId(item.subscriptionId),
    kind: item.kind,
    title: item.title,
    location: item.location,
    note: item.note,
    start: item.start,
    end: item.end,
    rrule: item.rrule,
    predecessorSeriesId: null,
    ruleRevision: 0,
    createdAt: '',
    updatedAt: '',
  };
}

function icsExceptionAsSeriesException(exception: IcsItemExceptionRecord): AppItemExceptionRecord {
  return {
    seriesId: `${exception.subscriptionId}:${exception.uid}`,
    originalStart: exception.originalStart,
    status: exception.status,
    title: exception.title,
    location: exception.location,
    note: exception.note,
    start: exception.start,
    end: exception.end,
    createdAt: '',
    updatedAt: '',
  };
}
