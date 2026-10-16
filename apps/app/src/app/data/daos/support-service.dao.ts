import { inject, Injectable } from '@angular/core';

import type {
  SupportServiceActionRecord,
  SupportServiceRecord,
} from '../entities/support-service.record';
import { SQLITE_DATABASE, type SqliteExecutor } from '../gateways/sqlite-database';

/** One entry as the search index holds it: its text already folded by `foldForSearch`. */
export interface SupportServiceSearchEntry {
  readonly supportServiceId: string;
  readonly name: string;
  readonly teaser: string;
  readonly region: string;
  readonly contacts: string;
}

interface SupportServiceRow {
  readonly id: string;
  readonly region: string;
  readonly name: string;
  readonly teaser: string;
  readonly icon: string;
  readonly actions: string;
  readonly position: number;
}

const COLUMNS = 'id, region, name, teaser, icon, actions, position';

/** Rows per `INSERT` - see `INSERT_CHUNK_ROWS` in `occurrence.dao.ts`; seven values per row. */
const INSERT_CHUNK_ROWS = 40;

/**
 * Column weights for `bm25()`, in the index's column order: the name counts most, then the teaser
 * and the region, the contact details least. The id column is not indexed and weighs nothing.
 */
const RANK = 'bm25(support_service_search, 0.0, 10.0, 4.0, 3.0, 1.0)';

/**
 * Table access for `support_services` and its full-text index `support_service_search` (see
 * `021-search-index.ts`). Both are written whole by `SupportServiceCatalogSync`.
 */
@Injectable({ providedIn: 'root' })
export class SupportServiceDao {
  private readonly database = inject(SQLITE_DATABASE);

  /** Every entry, in catalog order. */
  async listAll(executor: SqliteExecutor = this.database): Promise<SupportServiceRecord[]> {
    const rows = await executor.query<SupportServiceRow>(
      `SELECT ${COLUMNS} FROM support_services ORDER BY position ASC`,
    );
    return rows.map(toRecord);
  }

  /** The entries matching `match` (a `toFtsMatch` expression), best match first. */
  async search(
    match: string,
    executor: SqliteExecutor = this.database,
  ): Promise<SupportServiceRecord[]> {
    const rows = await executor.query<SupportServiceRow>(
      `SELECT ${COLUMNS.split(', ')
        .map((column) => `support_services.${column}`)
        .join(', ')}
       FROM support_service_search
       JOIN support_services ON support_services.id = support_service_search.support_service_id
       WHERE support_service_search MATCH ?
       ORDER BY ${RANK}, support_services.position ASC`,
      [match],
    );
    return rows.map(toRecord);
  }

  async count(executor: SqliteExecutor = this.database): Promise<number> {
    const rows = await executor.query<{ readonly count: number }>(
      `SELECT COUNT(*) AS count FROM support_services`,
    );
    return rows[0]?.count ?? 0;
  }

  async countIndexed(executor: SqliteExecutor = this.database): Promise<number> {
    const rows = await executor.query<{ readonly count: number }>(
      `SELECT COUNT(*) AS count FROM support_service_search`,
    );
    return rows[0]?.count ?? 0;
  }

  /**
   * Replaces every entry and the whole index. The catalog is small and has no per-entry state of
   * the user's to keep, so a full rewrite is the simplest reconciliation that cannot drift.
   */
  async replaceAll(
    records: readonly SupportServiceRecord[],
    index: readonly SupportServiceSearchEntry[],
    executor: SqliteExecutor = this.database,
  ): Promise<void> {
    await executor.run(`DELETE FROM support_services`);
    await executor.run(`DELETE FROM support_service_search`);

    for (let offset = 0; offset < records.length; offset += INSERT_CHUNK_ROWS) {
      const chunk = records.slice(offset, offset + INSERT_CHUNK_ROWS);
      await executor.run(
        `INSERT INTO support_services (${COLUMNS})
         VALUES ${new Array<string>(chunk.length).fill('(?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
        chunk.flatMap((record) => [
          record.id,
          record.region,
          record.name,
          record.teaser,
          record.icon,
          JSON.stringify(record.actions),
          record.position,
        ]),
      );
    }

    for (let offset = 0; offset < index.length; offset += INSERT_CHUNK_ROWS) {
      const chunk = index.slice(offset, offset + INSERT_CHUNK_ROWS);
      await executor.run(
        `INSERT INTO support_service_search (support_service_id, name, teaser, region, contacts)
         VALUES ${new Array<string>(chunk.length).fill('(?, ?, ?, ?, ?)').join(', ')}`,
        chunk.flatMap((entry) => [
          entry.supportServiceId,
          entry.name,
          entry.teaser,
          entry.region,
          entry.contacts,
        ]),
      );
    }
  }
}

function toRecord(row: SupportServiceRow): SupportServiceRecord {
  return {
    id: row.id,
    region: row.region,
    name: row.name,
    teaser: row.teaser,
    icon: row.icon,
    actions: JSON.parse(row.actions) as SupportServiceActionRecord[],
    position: row.position,
  };
}
