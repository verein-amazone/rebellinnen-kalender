import { inject, Injectable } from '@angular/core';

import type {
  CalendarRecord,
  CalendarSourceRecord,
  CalendarSourceState,
} from '../entities/calendar-source.record';
import { SQLITE_DATABASE, type SqliteExecutor } from '../gateways/sqlite-database';

/** The database shape of a `calendar_sources` row. */
interface CalendarSourceRow {
  readonly id: string;
  readonly type: CalendarSourceRecord['type'];
  readonly name: string;
  readonly enabled: number;
  readonly state: CalendarSourceState;
  readonly created_at: string;
  readonly updated_at: string;
}

/** The database shape of a `calendars` row. */
interface CalendarRow {
  readonly id: string;
  readonly source_id: string;
  readonly name: string;
  readonly color: string | null;
  readonly emoji: string | null;
  readonly enabled: number;
  readonly writable: number;
  readonly external_id: string | null;
  readonly native_source_id: string | null;
  readonly native_source_name: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

const SOURCE_COLUMNS = 'id, type, name, enabled, state, created_at, updated_at';
const CALENDAR_COLUMNS =
  'id, source_id, name, color, emoji, enabled, writable, external_id, native_source_id, native_source_name, created_at, updated_at';

/**
 * Table access for calendar sources and their calendars.
 *
 * No business rules live here: identifiers and timestamps are passed in, and every value is bound
 * as a parameter. Each method takes an optional executor so it can join a transaction; standalone
 * it runs against the database directly.
 */
@Injectable({ providedIn: 'root' })
export class CalendarSourceDao {
  private readonly database = inject(SQLITE_DATABASE);

  async listSources(executor: SqliteExecutor = this.database): Promise<CalendarSourceRecord[]> {
    const rows = await executor.query<CalendarSourceRow>(
      `SELECT ${SOURCE_COLUMNS} FROM calendar_sources ORDER BY created_at ASC, id ASC`,
    );

    return rows.map(toSourceRecord);
  }

  async findSource(
    id: string,
    executor: SqliteExecutor = this.database,
  ): Promise<CalendarSourceRecord | null> {
    const rows = await executor.query<CalendarSourceRow>(
      `SELECT ${SOURCE_COLUMNS} FROM calendar_sources WHERE id = ?`,
      [id],
    );

    const row = rows[0];
    return row ? toSourceRecord(row) : null;
  }

  async insertSource(
    record: CalendarSourceRecord,
    executor: SqliteExecutor = this.database,
  ): Promise<void> {
    await executor.run(
      `INSERT INTO calendar_sources (${SOURCE_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.type,
        record.name,
        record.enabled ? 1 : 0,
        record.state,
        record.createdAt,
        record.updatedAt,
      ],
    );
  }

  async updateSourceState(
    id: string,
    state: CalendarSourceState,
    updatedAt: string,
    executor: SqliteExecutor = this.database,
  ): Promise<void> {
    await executor.run(`UPDATE calendar_sources SET state = ?, updated_at = ? WHERE id = ?`, [
      state,
      updatedAt,
      id,
    ]);
  }

  async updateSourceEnabled(
    id: string,
    enabled: boolean,
    updatedAt: string,
    executor: SqliteExecutor = this.database,
  ): Promise<void> {
    await executor.run(`UPDATE calendar_sources SET enabled = ?, updated_at = ? WHERE id = ?`, [
      enabled ? 1 : 0,
      updatedAt,
      id,
    ]);
  }

  async updateSourceName(
    id: string,
    name: string,
    updatedAt: string,
    executor: SqliteExecutor = this.database,
  ): Promise<void> {
    await executor.run(`UPDATE calendar_sources SET name = ?, updated_at = ? WHERE id = ?`, [
      name,
      updatedAt,
      id,
    ]);
  }

  /** Deletes the source row only — dependent rows are the deleting unit of work's business. */
  async deleteSource(id: string, executor: SqliteExecutor = this.database): Promise<void> {
    await executor.run(`DELETE FROM calendar_sources WHERE id = ?`, [id]);
  }

  async findCalendar(
    id: string,
    executor: SqliteExecutor = this.database,
  ): Promise<CalendarRecord | null> {
    const rows = await executor.query<CalendarRow>(
      `SELECT ${CALENDAR_COLUMNS} FROM calendars WHERE id = ?`,
      [id],
    );

    const row = rows[0];
    return row ? toCalendarRecord(row) : null;
  }

  async listCalendars(executor: SqliteExecutor = this.database): Promise<CalendarRecord[]> {
    const rows = await executor.query<CalendarRow>(
      `SELECT ${CALENDAR_COLUMNS} FROM calendars ORDER BY created_at ASC, id ASC`,
    );

    return rows.map(toCalendarRecord);
  }

  async listCalendarsOfSource(
    sourceId: string,
    executor: SqliteExecutor = this.database,
  ): Promise<CalendarRecord[]> {
    const rows = await executor.query<CalendarRow>(
      `SELECT ${CALENDAR_COLUMNS} FROM calendars WHERE source_id = ? ORDER BY created_at ASC, id ASC`,
      [sourceId],
    );

    return rows.map(toCalendarRecord);
  }

  async insertCalendar(
    record: CalendarRecord,
    executor: SqliteExecutor = this.database,
  ): Promise<void> {
    await executor.run(
      `INSERT INTO calendars (${CALENDAR_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.sourceId,
        record.name,
        record.color,
        record.emoji,
        record.enabled ? 1 : 0,
        record.writable ? 1 : 0,
        record.externalId,
        record.nativeSourceId,
        record.nativeSourceName,
        record.createdAt,
        record.updatedAt,
      ],
    );
  }

  /** Updates the fields a device refresh may change without touching the user's own settings. */
  async updateCalendarSnapshot(
    id: string,
    name: string,
    writable: boolean,
    nativeSourceId: string | null,
    nativeSourceName: string | null,
    updatedAt: string,
    executor: SqliteExecutor = this.database,
  ): Promise<void> {
    await executor.run(
      `UPDATE calendars
       SET name = ?, writable = ?, native_source_id = ?, native_source_name = ?, updated_at = ?
       WHERE id = ?`,
      [name, writable ? 1 : 0, nativeSourceId, nativeSourceName, updatedAt, id],
    );
  }

  async updateCalendarIdentity(
    id: string,
    name: string,
    color: string | null,
    emoji: string | null,
    updatedAt: string,
    executor: SqliteExecutor = this.database,
  ): Promise<void> {
    await executor.run(
      `UPDATE calendars SET name = ?, color = ?, emoji = ?, updated_at = ? WHERE id = ?`,
      [name, color, emoji, updatedAt, id],
    );
  }

  async updateCalendarEmoji(
    id: string,
    emoji: string | null,
    updatedAt: string,
    executor: SqliteExecutor = this.database,
  ): Promise<void> {
    await executor.run(`UPDATE calendars SET emoji = ?, updated_at = ? WHERE id = ?`, [
      emoji,
      updatedAt,
      id,
    ]);
  }

  async updateCalendarEnabled(
    id: string,
    enabled: boolean,
    updatedAt: string,
    executor: SqliteExecutor = this.database,
  ): Promise<void> {
    await executor.run(`UPDATE calendars SET enabled = ?, updated_at = ? WHERE id = ?`, [
      enabled ? 1 : 0,
      updatedAt,
      id,
    ]);
  }

  async deleteCalendar(id: string, executor: SqliteExecutor = this.database): Promise<void> {
    await executor.run(`DELETE FROM calendars WHERE id = ?`, [id]);
  }

  async deleteCalendarsOfSource(
    sourceId: string,
    executor: SqliteExecutor = this.database,
  ): Promise<void> {
    await executor.run(`DELETE FROM calendars WHERE source_id = ?`, [sourceId]);
  }
}

function toSourceRecord(row: CalendarSourceRow): CalendarSourceRecord {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    enabled: row.enabled === 1,
    state: row.state,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCalendarRecord(row: CalendarRow): CalendarRecord {
  return {
    id: row.id,
    sourceId: row.source_id,
    name: row.name,
    color: row.color ?? null,
    emoji: row.emoji ?? null,
    enabled: row.enabled === 1,
    writable: row.writable === 1,
    externalId: row.external_id ?? null,
    nativeSourceId: row.native_source_id ?? null,
    nativeSourceName: row.native_source_name ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
