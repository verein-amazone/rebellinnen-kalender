import { inject, Injectable } from '@angular/core';

import type {
  AppItemExceptionRecord,
  AppItemExceptionStatus,
  AppItemKind,
  AppItemRecord,
} from '../entities/app-item.record';
import type { TemporalKind, TemporalValue } from '../entities/temporal-value';
import { SQLITE_DATABASE, type SqliteExecutor } from '../gateways/sqlite-database';

/** The database shape of an `app_items` row. */
interface AppItemRow {
  readonly id: string;
  readonly calendar_id: string;
  readonly kind: AppItemKind;
  readonly title: string;
  readonly location: string | null;
  readonly note: string | null;
  readonly start_kind: TemporalKind;
  readonly start_value: string;
  readonly start_tz: string | null;
  readonly end_kind: TemporalKind | null;
  readonly end_value: string | null;
  readonly end_tz: string | null;
  readonly rrule: string | null;
  readonly predecessor_series_id: string | null;
  readonly rule_revision: number;
  readonly created_at: string;
  readonly updated_at: string;
}

/** The database shape of an `app_item_exceptions` row. */
interface AppItemExceptionRow {
  readonly series_id: string;
  readonly original_start: string;
  readonly status: AppItemExceptionStatus;
  readonly title: string | null;
  readonly location: string | null;
  readonly note: string | null;
  readonly start_kind: TemporalKind | null;
  readonly start_value: string | null;
  readonly start_tz: string | null;
  readonly end_kind: TemporalKind | null;
  readonly end_value: string | null;
  readonly end_tz: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

const ITEM_COLUMNS = `id, calendar_id, kind, title, location, note,
  start_kind, start_value, start_tz, end_kind, end_value, end_tz,
  rrule, predecessor_series_id, rule_revision, created_at, updated_at`;

const EXCEPTION_COLUMNS = `series_id, original_start, status, title, location, note,
  start_kind, start_value, start_tz, end_kind, end_value, end_tz, created_at, updated_at`;

/**
 * Table access for canonical app-owned items and their occurrence exceptions.
 *
 * No business rules live here: identifiers and timestamps are passed in, and every value is bound
 * as a parameter. Each method takes an optional executor so it can join a transaction.
 */
@Injectable({ providedIn: 'root' })
export class AppCalendarItemDao {
  private readonly database = inject(SQLITE_DATABASE);

  async listAll(executor: SqliteExecutor = this.database): Promise<AppItemRecord[]> {
    const rows = await executor.query<AppItemRow>(
      `SELECT ${ITEM_COLUMNS} FROM app_items ORDER BY created_at ASC, id ASC`,
    );

    return rows.map(toItemRecord);
  }

  async find(id: string, executor: SqliteExecutor = this.database): Promise<AppItemRecord | null> {
    const rows = await executor.query<AppItemRow>(
      `SELECT ${ITEM_COLUMNS} FROM app_items WHERE id = ?`,
      [id],
    );

    const row = rows[0];
    return row ? toItemRecord(row) : null;
  }

  async insert(record: AppItemRecord, executor: SqliteExecutor = this.database): Promise<void> {
    await executor.run(
      `INSERT INTO app_items (${ITEM_COLUMNS})
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.calendarId,
        record.kind,
        record.title,
        record.location,
        record.note,
        record.start.kind,
        record.start.value,
        record.start.timeZone,
        record.end?.kind ?? null,
        record.end?.value ?? null,
        record.end?.timeZone ?? null,
        record.rrule,
        record.predecessorSeriesId,
        record.ruleRevision,
        record.createdAt,
        record.updatedAt,
      ],
    );
  }

  /**
   * Rewrites every mutable field. One full update instead of many partial ones: the callers are
   * units of work that computed the complete next state anyway, and a single shape cannot drift.
   */
  async update(record: AppItemRecord, executor: SqliteExecutor = this.database): Promise<void> {
    await executor.run(
      `UPDATE app_items SET
         calendar_id = ?, kind = ?, title = ?, location = ?, note = ?,
         start_kind = ?, start_value = ?, start_tz = ?,
         end_kind = ?, end_value = ?, end_tz = ?,
         rrule = ?, predecessor_series_id = ?, rule_revision = ?, updated_at = ?
       WHERE id = ?`,
      [
        record.calendarId,
        record.kind,
        record.title,
        record.location,
        record.note,
        record.start.kind,
        record.start.value,
        record.start.timeZone,
        record.end?.kind ?? null,
        record.end?.value ?? null,
        record.end?.timeZone ?? null,
        record.rrule,
        record.predecessorSeriesId,
        record.ruleRevision,
        record.updatedAt,
        record.id,
      ],
    );
  }

  async delete(id: string, executor: SqliteExecutor = this.database): Promise<void> {
    await executor.run(`DELETE FROM app_items WHERE id = ?`, [id]);
  }

  /**
   * Every exception of every series, for callers that rematerialize a whole source and would
   * otherwise ask once per item. Ordered by series first so the caller can group them without
   * losing the `original_start` order each series is materialized in.
   */
  async listAllExceptions(
    executor: SqliteExecutor = this.database,
  ): Promise<AppItemExceptionRecord[]> {
    const rows = await executor.query<AppItemExceptionRow>(
      `SELECT ${EXCEPTION_COLUMNS} FROM app_item_exceptions
       ORDER BY series_id ASC, original_start ASC`,
    );

    return rows.map(toExceptionRecord);
  }

  async listExceptionsOfSeries(
    seriesId: string,
    executor: SqliteExecutor = this.database,
  ): Promise<AppItemExceptionRecord[]> {
    const rows = await executor.query<AppItemExceptionRow>(
      `SELECT ${EXCEPTION_COLUMNS} FROM app_item_exceptions
       WHERE series_id = ? ORDER BY original_start ASC`,
      [seriesId],
    );

    return rows.map(toExceptionRecord);
  }

  async upsertException(
    record: AppItemExceptionRecord,
    executor: SqliteExecutor = this.database,
  ): Promise<void> {
    await executor.run(
      `INSERT INTO app_item_exceptions (${EXCEPTION_COLUMNS})
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (series_id, original_start) DO UPDATE SET
         status = excluded.status, title = excluded.title, location = excluded.location,
         note = excluded.note, start_kind = excluded.start_kind,
         start_value = excluded.start_value, start_tz = excluded.start_tz,
         end_kind = excluded.end_kind, end_value = excluded.end_value, end_tz = excluded.end_tz,
         updated_at = excluded.updated_at`,
      [
        record.seriesId,
        record.originalStart,
        record.status,
        record.title,
        record.location,
        record.note,
        record.start?.kind ?? null,
        record.start?.value ?? null,
        record.start?.timeZone ?? null,
        record.end?.kind ?? null,
        record.end?.value ?? null,
        record.end?.timeZone ?? null,
        record.createdAt,
        record.updatedAt,
      ],
    );
  }

  async deleteException(
    seriesId: string,
    originalStart: string,
    executor: SqliteExecutor = this.database,
  ): Promise<void> {
    await executor.run(
      `DELETE FROM app_item_exceptions WHERE series_id = ? AND original_start = ?`,
      [seriesId, originalStart],
    );
  }

  async deleteExceptionsOfSeries(
    seriesId: string,
    executor: SqliteExecutor = this.database,
  ): Promise<void> {
    await executor.run(`DELETE FROM app_item_exceptions WHERE series_id = ?`, [seriesId]);
  }

  /**
   * Deletes every exception at or after the given original start - the tail a
   * „this and following“ edit removes from the old series. Original starts of one series share one
   * temporal kind, so their ISO strings compare in time order.
   */
  async deleteExceptionsFrom(
    seriesId: string,
    originalStart: string,
    executor: SqliteExecutor = this.database,
  ): Promise<void> {
    await executor.run(
      `DELETE FROM app_item_exceptions WHERE series_id = ? AND original_start >= ?`,
      [seriesId, originalStart],
    );
  }
}

function toItemRecord(row: AppItemRow): AppItemRecord {
  return {
    id: row.id,
    calendarId: row.calendar_id,
    kind: row.kind,
    title: row.title,
    location: row.location ?? null,
    note: row.note ?? null,
    start: { kind: row.start_kind, value: row.start_value, timeZone: row.start_tz ?? null },
    end: toOptionalTemporal(row.end_kind, row.end_value, row.end_tz),
    rrule: row.rrule ?? null,
    predecessorSeriesId: row.predecessor_series_id ?? null,
    ruleRevision: row.rule_revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toExceptionRecord(row: AppItemExceptionRow): AppItemExceptionRecord {
  return {
    seriesId: row.series_id,
    originalStart: row.original_start,
    status: row.status,
    title: row.title ?? null,
    location: row.location ?? null,
    note: row.note ?? null,
    start: toOptionalTemporal(row.start_kind, row.start_value, row.start_tz),
    end: toOptionalTemporal(row.end_kind, row.end_value, row.end_tz),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toOptionalTemporal(
  kind: TemporalKind | null | undefined,
  value: string | null | undefined,
  timeZone: string | null | undefined,
): TemporalValue | null {
  if (kind == null || value == null) {
    return null;
  }

  return { kind, value, timeZone: timeZone ?? null };
}
