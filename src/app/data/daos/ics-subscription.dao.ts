import { inject, Injectable } from '@angular/core';

import type { IcsSubscriptionRecord } from '../entities/ics.record';
import { SQLITE_DATABASE, type SqliteExecutor } from '../gateways/sqlite-database';

/** The database shape of an `ics_subscriptions` row. */
interface SubscriptionRow {
  readonly id: string;
  readonly url: string;
  readonly allow_insecure: number;
  readonly etag: string | null;
  readonly last_modified: string | null;
  readonly last_success_at: string | null;
  readonly last_attempt_at: string | null;
  readonly last_error: string | null;
  readonly active_revision_id: string | null;
  readonly raw_ics: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

const COLUMNS = `id, url, allow_insecure, etag, last_modified, last_success_at, last_attempt_at,
  last_error, active_revision_id, raw_ics, created_at, updated_at`;

/**
 * Table access for ICS subscriptions. The URL is sensitive; this DAO stores and returns it, and
 * everything above is responsible for never logging or displaying it unredacted.
 */
@Injectable({ providedIn: 'root' })
export class IcsSubscriptionDao {
  private readonly database = inject(SQLITE_DATABASE);

  async list(executor: SqliteExecutor = this.database): Promise<IcsSubscriptionRecord[]> {
    const rows = await executor.query<SubscriptionRow>(
      `SELECT ${COLUMNS} FROM ics_subscriptions ORDER BY created_at ASC, id ASC`,
    );

    return rows.map(toRecord);
  }

  async find(
    id: string,
    executor: SqliteExecutor = this.database,
  ): Promise<IcsSubscriptionRecord | null> {
    const rows = await executor.query<SubscriptionRow>(
      `SELECT ${COLUMNS} FROM ics_subscriptions WHERE id = ?`,
      [id],
    );

    const row = rows[0];
    return row ? toRecord(row) : null;
  }

  async insert(
    record: IcsSubscriptionRecord,
    executor: SqliteExecutor = this.database,
  ): Promise<void> {
    await executor.run(
      `INSERT INTO ics_subscriptions (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.url,
        record.allowInsecure ? 1 : 0,
        record.etag,
        record.lastModified,
        record.lastSuccessAt,
        record.lastAttemptAt,
        record.lastError,
        record.activeRevisionId,
        record.rawIcs,
        record.createdAt,
        record.updatedAt,
      ],
    );
  }

  /** A successful refresh: the new revision is active, HTTP cache metadata and raw text kept. */
  async recordSuccess(
    id: string,
    revisionId: string,
    rawIcs: string,
    etag: string | null,
    lastModified: string | null,
    nowUtc: string,
    executor: SqliteExecutor = this.database,
  ): Promise<void> {
    await executor.run(
      `UPDATE ics_subscriptions SET active_revision_id = ?, raw_ics = ?, etag = ?,
         last_modified = ?, last_success_at = ?, last_attempt_at = ?, last_error = NULL,
         updated_at = ?
       WHERE id = ?`,
      [revisionId, rawIcs, etag, lastModified, nowUtc, nowUtc, nowUtc, id],
    );
  }

  /** A response that confirmed the cached revision is still current. */
  async recordNotModified(
    id: string,
    nowUtc: string,
    executor: SqliteExecutor = this.database,
  ): Promise<void> {
    await executor.run(
      `UPDATE ics_subscriptions SET last_attempt_at = ?, last_error = NULL, updated_at = ?
       WHERE id = ?`,
      [nowUtc, nowUtc, id],
    );
  }

  /** A failed refresh: the previous revision stays untouched; only the error is recorded. */
  async recordFailure(
    id: string,
    error: string,
    nowUtc: string,
    executor: SqliteExecutor = this.database,
  ): Promise<void> {
    await executor.run(
      `UPDATE ics_subscriptions SET last_attempt_at = ?, last_error = ?, updated_at = ?
       WHERE id = ?`,
      [nowUtc, error, nowUtc, id],
    );
  }

  async delete(id: string, executor: SqliteExecutor = this.database): Promise<void> {
    await executor.run(`DELETE FROM ics_subscriptions WHERE id = ?`, [id]);
  }
}

function toRecord(row: SubscriptionRow): IcsSubscriptionRecord {
  return {
    id: row.id,
    url: row.url,
    allowInsecure: row.allow_insecure === 1,
    etag: row.etag ?? null,
    lastModified: row.last_modified ?? null,
    lastSuccessAt: row.last_success_at ?? null,
    lastAttemptAt: row.last_attempt_at ?? null,
    lastError: row.last_error ?? null,
    activeRevisionId: row.active_revision_id ?? null,
    rawIcs: row.raw_ics ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
