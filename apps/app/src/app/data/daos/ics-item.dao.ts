import { inject, Injectable } from '@angular/core';

import type { AppItemExceptionStatus, AppItemKind } from '../entities/app-item.record';
import type { IcsItemExceptionRecord, IcsItemRecord } from '../entities/ics.record';
import type { TemporalKind, TemporalValue } from '../entities/temporal-value';
import { SQLITE_DATABASE, type SqlValue, type SqliteExecutor } from '../gateways/sqlite-database';

/** The database shape of an `ics_items` row. */
interface ItemRow {
  readonly subscription_id: string;
  readonly uid: string;
  readonly revision_id: string;
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
}

/** The database shape of an `ics_item_exceptions` row. */
interface ExceptionRow {
  readonly subscription_id: string;
  readonly uid: string;
  readonly original_start: string;
  readonly revision_id: string;
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
}

const ITEM_COLUMNS = `subscription_id, uid, revision_id, kind, title, location, note,
  start_kind, start_value, start_tz, end_kind, end_value, end_tz, rrule`;
const EXCEPTION_COLUMNS = `subscription_id, uid, original_start, revision_id, status, title,
  location, note, start_kind, start_value, start_tz, end_kind, end_value, end_tz`;

/**
 * Both tables have 14 columns, so 60 rows bind 840 values - under the 999-variable limit older
 * SQLite builds enforce. See `INSERT_CHUNK_ROWS` in `occurrence.dao.ts` for the full reasoning.
 */
const INSERT_CHUNK_ROWS = 60;

/** Table access for the normalized items of ICS subscriptions. */
@Injectable({ providedIn: 'root' })
export class IcsItemDao {
  private readonly database = inject(SQLITE_DATABASE);

  async listItems(
    subscriptionId: string,
    executor: SqliteExecutor = this.database,
  ): Promise<IcsItemRecord[]> {
    const rows = await executor.query<ItemRow>(
      `SELECT ${ITEM_COLUMNS} FROM ics_items WHERE subscription_id = ? ORDER BY uid ASC`,
      [subscriptionId],
    );

    return rows.map(toItemRecord);
  }

  /**
   * Every exception of one subscription. Whole-subscription rather than per item, because
   * rematerializing a source needs all of them and would otherwise ask once per item; the caller
   * groups by uid in memory, which the `uid` ordering keeps cheap without disturbing the
   * `original_start` order each item is materialized in.
   */
  async listExceptions(
    subscriptionId: string,
    executor: SqliteExecutor = this.database,
  ): Promise<IcsItemExceptionRecord[]> {
    const rows = await executor.query<ExceptionRow>(
      `SELECT ${EXCEPTION_COLUMNS} FROM ics_item_exceptions
       WHERE subscription_id = ? ORDER BY uid ASC, original_start ASC`,
      [subscriptionId],
    );

    return rows.map(toExceptionRecord);
  }

  /**
   * Writes a whole feed's items in chunked multi-row statements - a subscription is normalized in
   * one go, and one statement per item made a large feed thousands of round trips. `OR REPLACE`
   * still applies per row inside a multi-row `VALUES`, so a feed repeating a uid resolves to its
   * last entry exactly as before.
   */
  async insertItems(
    records: readonly IcsItemRecord[],
    executor: SqliteExecutor = this.database,
  ): Promise<void> {
    await this.insertChunked('ics_items', ITEM_COLUMNS, records, toItemValues, executor);
  }

  async insertExceptions(
    records: readonly IcsItemExceptionRecord[],
    executor: SqliteExecutor = this.database,
  ): Promise<void> {
    await this.insertChunked(
      'ics_item_exceptions',
      EXCEPTION_COLUMNS,
      records,
      toExceptionValues,
      executor,
    );
  }

  private async insertChunked<TRecord>(
    table: string,
    columns: string,
    records: readonly TRecord[],
    toValues: (record: TRecord) => SqlValue[],
    executor: SqliteExecutor,
  ): Promise<void> {
    const row = `(${new Array<string>(columns.split(',').length).fill('?').join(', ')})`;

    for (let offset = 0; offset < records.length; offset += INSERT_CHUNK_ROWS) {
      const chunk = records.slice(offset, offset + INSERT_CHUNK_ROWS);

      await executor.run(
        `INSERT OR REPLACE INTO ${table} (${columns}) VALUES ${new Array<string>(chunk.length).fill(row).join(', ')}`,
        chunk.flatMap(toValues),
      );
    }
  }

  /** Clears one subscription's normalized data - only ever inside a revision swap or removal. */
  async deleteOfSubscription(
    subscriptionId: string,
    executor: SqliteExecutor = this.database,
  ): Promise<void> {
    await executor.run(`DELETE FROM ics_item_exceptions WHERE subscription_id = ?`, [
      subscriptionId,
    ]);
    await executor.run(`DELETE FROM ics_items WHERE subscription_id = ?`, [subscriptionId]);
  }
}

/** One item's bound values, in the order `ITEM_COLUMNS` lists them - edit the two together. */
function toItemValues(record: IcsItemRecord): SqlValue[] {
  return [
    record.subscriptionId,
    record.uid,
    record.revisionId,
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
  ];
}

/** One exception's bound values, in `EXCEPTION_COLUMNS` order - edit the two together. */
function toExceptionValues(record: IcsItemExceptionRecord): SqlValue[] {
  return [
    record.subscriptionId,
    record.uid,
    record.originalStart,
    record.revisionId,
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
  ];
}

function toItemRecord(row: ItemRow): IcsItemRecord {
  return {
    subscriptionId: row.subscription_id,
    uid: row.uid,
    revisionId: row.revision_id,
    kind: row.kind,
    title: row.title,
    location: row.location ?? null,
    note: row.note ?? null,
    start: { kind: row.start_kind, value: row.start_value, timeZone: row.start_tz ?? null },
    end: toOptionalTemporal(row.end_kind, row.end_value, row.end_tz),
    rrule: row.rrule ?? null,
  };
}

function toExceptionRecord(row: ExceptionRow): IcsItemExceptionRecord {
  return {
    subscriptionId: row.subscription_id,
    uid: row.uid,
    originalStart: row.original_start,
    revisionId: row.revision_id,
    status: row.status,
    title: row.title ?? null,
    location: row.location ?? null,
    note: row.note ?? null,
    start: toOptionalTemporal(row.start_kind, row.start_value, row.start_tz),
    end: toOptionalTemporal(row.end_kind, row.end_value, row.end_tz),
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
