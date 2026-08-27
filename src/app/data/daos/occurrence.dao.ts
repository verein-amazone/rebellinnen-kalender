import { inject, Injectable } from '@angular/core';

import type { AppItemKind } from '../entities/app-item.record';
import type { CalendarSourceType } from '../entities/calendar-source.record';
import type {
  OccurrenceProvenance,
  OccurrenceRecord,
  SourceCoverageRecord,
} from '../entities/occurrence.record';
import type { TemporalKind } from '../entities/temporal-value';
import { SQLITE_DATABASE, type SqliteExecutor } from '../gateways/sqlite-database';

/** The database shape of an `occurrences` row. */
interface OccurrenceRow {
  readonly id: string;
  readonly source_id: string;
  readonly source_type: CalendarSourceType;
  readonly calendar_id: string;
  readonly series_id: string | null;
  readonly original_start: string | null;
  readonly provenance: OccurrenceProvenance;
  readonly item_kind: AppItemKind;
  readonly item_id: string | null;
  readonly title: string;
  readonly location: string | null;
  readonly description: string | null;
  readonly is_all_day: number;
  readonly start_kind: TemporalKind;
  readonly start_value: string;
  readonly start_tz: string | null;
  readonly end_kind: TemporalKind | null;
  readonly end_value: string | null;
  readonly end_tz: string | null;
  readonly start_utc: string;
  readonly end_utc: string;
  readonly start_local_day: string;
  readonly end_local_day: string;
  readonly external_id: string | null;
}

/** The database shape of a `source_coverage` row. */
interface CoverageRow {
  readonly source_id: string;
  readonly window_start_utc: string;
  readonly window_end_utc: string;
  readonly engine_version: string;
  readonly updated_at: string;
}

const COLUMNS = `id, source_id, source_type, calendar_id, series_id, original_start, provenance,
  item_kind, item_id, title, location, description, is_all_day, start_kind, start_value, start_tz,
  end_kind, end_value, end_tz, start_utc, end_utc, start_local_day, end_local_day, external_id`;

/**
 * Table access for the materialized occurrence layer and its coverage rows.
 *
 * Every method takes an optional executor: replacing derived rows is always part of a unit of work
 * that must never be seen half-done, so the callers are expected to pass a transaction.
 */
@Injectable({ providedIn: 'root' })
export class OccurrenceDao {
  private readonly database = inject(SQLITE_DATABASE);

  /**
   * Timed rows overlap the range as half-open intervals (`start < rangeEnd AND end > rangeStart`);
   * a zero-length row (`end = start`) still counts at its instant. Ordered by start, all-day rows
   * of a day before its timed ones, title as the final tie-break so the result is deterministic.
   */
  async listInRange(
    rangeStartUtc: string,
    rangeEndUtc: string,
    executor: SqliteExecutor = this.database,
  ): Promise<OccurrenceRecord[]> {
    const rows = await executor.query<OccurrenceRow>(
      `SELECT ${COLUMNS} FROM occurrences
       WHERE (start_utc < ? AND end_utc > ?) OR (start_utc = end_utc AND start_utc >= ? AND start_utc < ?)
       ORDER BY start_local_day ASC, is_all_day DESC, start_utc ASC, title ASC, id ASC`,
      [rangeEndUtc, rangeStartUtc, rangeStartUtc, rangeEndUtc],
    );

    return rows.map(toRecord);
  }

  async insertMany(
    records: readonly OccurrenceRecord[],
    executor: SqliteExecutor = this.database,
  ): Promise<void> {
    for (const record of records) {
      await executor.run(
        `INSERT INTO occurrences (${COLUMNS})
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.id,
          record.sourceId,
          record.sourceType,
          record.calendarId,
          record.seriesId,
          record.originalStart,
          record.provenance,
          record.itemKind,
          record.itemId,
          record.title,
          record.location,
          record.description,
          record.isAllDay ? 1 : 0,
          record.start.kind,
          record.start.value,
          record.start.timeZone,
          record.end?.kind ?? null,
          record.end?.value ?? null,
          record.end?.timeZone ?? null,
          record.startUtc,
          record.endUtc,
          record.startLocalDay,
          record.endLocalDay,
          record.externalId,
        ],
      );
    }
  }

  async deleteOfSeries(seriesId: string, executor: SqliteExecutor = this.database): Promise<void> {
    await executor.run(`DELETE FROM occurrences WHERE series_id = ?`, [seriesId]);
  }

  /** Deletes the series tail from a split point on - original starts share one temporal kind. */
  async deleteOfSeriesFrom(
    seriesId: string,
    originalStart: string,
    executor: SqliteExecutor = this.database,
  ): Promise<void> {
    await executor.run(`DELETE FROM occurrences WHERE series_id = ? AND original_start >= ?`, [
      seriesId,
      originalStart,
    ]);
  }

  async deleteOfSource(sourceId: string, executor: SqliteExecutor = this.database): Promise<void> {
    await executor.run(`DELETE FROM occurrences WHERE source_id = ?`, [sourceId]);
  }

  /** Removes one source's rows overlapping a range - the swap a device refresh replaces. */
  async deleteOfSourceInRange(
    sourceId: string,
    rangeStartUtc: string,
    rangeEndUtc: string,
    executor: SqliteExecutor = this.database,
  ): Promise<void> {
    await executor.run(
      `DELETE FROM occurrences
       WHERE source_id = ?
         AND ((start_utc < ? AND end_utc > ?) OR (start_utc = end_utc AND start_utc >= ? AND start_utc < ?))`,
      [sourceId, rangeEndUtc, rangeStartUtc, rangeStartUtc, rangeEndUtc],
    );
  }

  async deleteByCalendar(
    calendarId: string,
    executor: SqliteExecutor = this.database,
  ): Promise<void> {
    await executor.run(`DELETE FROM occurrences WHERE calendar_id = ?`, [calendarId]);
  }

  async deleteOne(id: string, executor: SqliteExecutor = this.database): Promise<void> {
    await executor.run(`DELETE FROM occurrences WHERE id = ?`, [id]);
  }

  async findOne(
    id: string,
    executor: SqliteExecutor = this.database,
  ): Promise<OccurrenceRecord | null> {
    const rows = await executor.query<OccurrenceRow>(
      `SELECT ${COLUMNS} FROM occurrences WHERE id = ?`,
      [id],
    );

    const row = rows[0];
    return row ? toRecord(row) : null;
  }

  /** Cached device instances - the rows a device-zone change repairs locally, without a refetch. */
  async listOfSourceType(
    sourceType: OccurrenceRecord['sourceType'],
    executor: SqliteExecutor = this.database,
  ): Promise<OccurrenceRecord[]> {
    const rows = await executor.query<OccurrenceRow>(
      `SELECT ${COLUMNS} FROM occurrences WHERE source_type = ?`,
      [sourceType],
    );

    return rows.map(toRecord);
  }

  /**
   * Rewrites only the local-day bucketing columns of one row - used to repair cached device rows
   * after a device timezone change, where the underlying UTC instants are still correct and only
   * their day assignment needs to move.
   */
  async updateLocalDays(
    id: string,
    startLocalDay: string,
    endLocalDay: string,
    executor: SqliteExecutor = this.database,
  ): Promise<void> {
    await executor.run(
      `UPDATE occurrences SET start_local_day = ?, end_local_day = ? WHERE id = ?`,
      [startLocalDay, endLocalDay, id],
    );
  }

  async findCoverage(
    sourceId: string,
    executor: SqliteExecutor = this.database,
  ): Promise<SourceCoverageRecord | null> {
    const rows = await executor.query<CoverageRow>(
      `SELECT source_id, window_start_utc, window_end_utc, engine_version, updated_at
       FROM source_coverage WHERE source_id = ?`,
      [sourceId],
    );

    const row = rows[0];
    return row
      ? {
          sourceId: row.source_id,
          windowStartUtc: row.window_start_utc,
          windowEndUtc: row.window_end_utc,
          engineVersion: row.engine_version,
          updatedAt: row.updated_at,
        }
      : null;
  }

  async upsertCoverage(
    record: SourceCoverageRecord,
    executor: SqliteExecutor = this.database,
  ): Promise<void> {
    await executor.run(
      `INSERT INTO source_coverage (source_id, window_start_utc, window_end_utc, engine_version, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (source_id) DO UPDATE SET
         window_start_utc = excluded.window_start_utc,
         window_end_utc = excluded.window_end_utc,
         engine_version = excluded.engine_version,
         updated_at = excluded.updated_at`,
      [
        record.sourceId,
        record.windowStartUtc,
        record.windowEndUtc,
        record.engineVersion,
        record.updatedAt,
      ],
    );
  }

  async deleteCoverage(sourceId: string, executor: SqliteExecutor = this.database): Promise<void> {
    await executor.run(`DELETE FROM source_coverage WHERE source_id = ?`, [sourceId]);
  }
}

function toRecord(row: OccurrenceRow): OccurrenceRecord {
  return {
    id: row.id,
    sourceId: row.source_id,
    sourceType: row.source_type,
    calendarId: row.calendar_id,
    seriesId: row.series_id ?? null,
    originalStart: row.original_start ?? null,
    provenance: row.provenance,
    itemKind: row.item_kind,
    itemId: row.item_id ?? null,
    title: row.title,
    location: row.location ?? null,
    description: row.description ?? null,
    isAllDay: row.is_all_day === 1,
    start: { kind: row.start_kind, value: row.start_value, timeZone: row.start_tz ?? null },
    end:
      row.end_kind != null && row.end_value != null
        ? { kind: row.end_kind, value: row.end_value, timeZone: row.end_tz ?? null }
        : null,
    startUtc: row.start_utc,
    endUtc: row.end_utc,
    startLocalDay: row.start_local_day,
    endLocalDay: row.end_local_day,
    externalId: row.external_id ?? null,
  };
}
