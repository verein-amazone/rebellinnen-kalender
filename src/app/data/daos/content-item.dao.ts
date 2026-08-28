import { inject, Injectable } from '@angular/core';

import type {
  ContentItemKind,
  ContentItemRecord,
  DailyRenderMode,
  RelatedSourceRecord,
} from '../entities/content-item.record';
import { SQLITE_DATABASE, type SqliteExecutor, type SqlValue } from '../gateways/sqlite-database';

/** The database shape of a `content_items` row. */
interface ContentItemRow {
  readonly id: string;
  readonly kind: ContentItemKind;
  readonly title: string;
  readonly teaser: string;
  readonly body_markdown: string;
  readonly image_path: string | null;
  readonly image_alt: string | null;
  readonly image_attribution: string | null;
  readonly source_label: string | null;
  readonly source_url: string | null;
  readonly related_sources: string | null;
  readonly valid_from: string | null;
  readonly valid_to: string | null;
  readonly eligible_for_daily: number;
  readonly daily_render: DailyRenderMode | null;
}

const COLUMNS = `id, kind, title, teaser, body_markdown, image_path, image_alt, image_attribution,
  source_label, source_url, related_sources, valid_from, valid_to, eligible_for_daily,
  daily_render`;

/**
 * Table access for curated content items. No business rules live here - the daily-selection logic
 * that picks *which* eligible item to feature belongs to `select-daily-impulse`, not this DAO.
 */
@Injectable({ providedIn: 'root' })
export class ContentItemDao {
  private readonly database = inject(SQLITE_DATABASE);

  async findById(
    id: string,
    executor: SqliteExecutor = this.database,
  ): Promise<ContentItemRecord | null> {
    const rows = await executor.query<ContentItemRow>(
      `SELECT ${COLUMNS} FROM content_items WHERE id = ?`,
      [id],
    );

    const row = rows[0];
    return row ? toRecord(row) : null;
  }

  /**
   * Items eligible for daily selection on `day` (`YYYY-MM-DD`): flagged `eligible_for_daily` and
   * either evergreen (`valid_from`/`valid_to` both unset) or `day` falls inside whichever bound(s)
   * are set.
   */
  async listEligibleForDay(
    day: string,
    executor: SqliteExecutor = this.database,
  ): Promise<ContentItemRecord[]> {
    const rows = await executor.query<ContentItemRow>(
      `SELECT ${COLUMNS} FROM content_items
       WHERE eligible_for_daily = 1
         AND (valid_from IS NULL OR valid_from <= ?)
         AND (valid_to IS NULL OR valid_to >= ?)
       ORDER BY id ASC`,
      [day, day],
    );

    return rows.map(toRecord);
  }

  /** Every stored item, for the debug content listing. */
  async listAll(executor: SqliteExecutor = this.database): Promise<ContentItemRecord[]> {
    const rows = await executor.query<ContentItemRow>(
      `SELECT ${COLUMNS} FROM content_items ORDER BY kind ASC, id ASC`,
    );
    return rows.map(toRecord);
  }

  /** Every stored item's id, for `ContentCatalogSync` to diff against the catalog asset. */
  async listIds(executor: SqliteExecutor = this.database): Promise<string[]> {
    const rows = await executor.query<{ id: string }>(`SELECT id FROM content_items`);
    return rows.map((row) => row.id);
  }

  /**
   * Inserts a new item or overwrites an existing one in place. Deliberately update-or-insert
   * rather than `INSERT OR REPLACE`: a replace deletes the row first, which would momentarily
   * dangle any `bookmarks` row referencing it under an enforced foreign key.
   */
  async upsert(record: ContentItemRecord, executor: SqliteExecutor = this.database): Promise<void> {
    const existing = await this.findById(record.id, executor);
    if (existing === null) {
      await executor.run(
        `INSERT INTO content_items (${COLUMNS})
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        toValues(record),
      );
      return;
    }

    await executor.run(
      `UPDATE content_items
       SET kind = ?, title = ?, teaser = ?, body_markdown = ?, image_path = ?, image_alt = ?,
           image_attribution = ?, source_label = ?, source_url = ?, related_sources = ?,
           valid_from = ?, valid_to = ?, eligible_for_daily = ?, daily_render = ?
       WHERE id = ?`,
      [
        record.kind,
        record.title,
        record.teaser,
        record.bodyMarkdown,
        record.imagePath,
        record.imageAlt,
        record.imageAttribution,
        record.sourceLabel,
        record.sourceUrl,
        serializeRelatedSources(record.relatedSources),
        record.validFrom,
        record.validTo,
        record.eligibleForDaily ? 1 : 0,
        record.dailyRender,
        record.id,
      ],
    );
  }

  async delete(id: string, executor: SqliteExecutor = this.database): Promise<void> {
    await executor.run(`DELETE FROM content_items WHERE id = ?`, [id]);
  }
}

function toValues(record: ContentItemRecord): SqlValue[] {
  return [
    record.id,
    record.kind,
    record.title,
    record.teaser,
    record.bodyMarkdown,
    record.imagePath,
    record.imageAlt,
    record.imageAttribution,
    record.sourceLabel,
    record.sourceUrl,
    serializeRelatedSources(record.relatedSources),
    record.validFrom,
    record.validTo,
    record.eligibleForDaily ? 1 : 0,
    record.dailyRender,
  ];
}

function toRecord(row: ContentItemRow): ContentItemRecord {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    teaser: row.teaser,
    bodyMarkdown: row.body_markdown,
    imagePath: row.image_path ?? null,
    imageAlt: row.image_alt ?? null,
    imageAttribution: row.image_attribution ?? null,
    sourceLabel: row.source_label ?? null,
    sourceUrl: row.source_url ?? null,
    relatedSources: deserializeRelatedSources(row.related_sources),
    validFrom: row.valid_from ?? null,
    validTo: row.valid_to ?? null,
    eligibleForDaily: row.eligible_for_daily === 1,
    // A row written before the column existed carries the layout the card had back then.
    dailyRender: row.daily_render ?? 'teaser',
  };
}

function serializeRelatedSources(sources: readonly RelatedSourceRecord[]): string | null {
  return sources.length === 0 ? null : JSON.stringify(sources);
}

function deserializeRelatedSources(value: string | null): readonly RelatedSourceRecord[] {
  return value === null ? [] : (JSON.parse(value) as RelatedSourceRecord[]);
}
