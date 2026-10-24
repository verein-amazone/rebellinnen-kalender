import { inject, Injectable } from '@angular/core';

import type {
  ContentItemKind,
  ContentItemRecord,
  RelatedSourceRecord,
  VideoRecord,
} from '../entities/content-item.record';
import { SQLITE_DATABASE, type SqliteExecutor, type SqlValue } from '../gateways/sqlite-database';

/** The database shape of a `content_items` row. */
interface ContentItemRow {
  readonly id: string;
  readonly kind: ContentItemKind;
  readonly title: string;
  readonly teaser: string;
  readonly body_markdown: string;
  readonly hero_image_id: string | null;
  readonly source_label: string | null;
  readonly source_url: string | null;
  readonly related_sources: string | null;
  readonly valid_from: string | null;
  readonly valid_to: string | null;
  readonly eligible_for_daily: number;
  readonly video: string | null;
  readonly support_service_ids: string | null;
}

const COLUMNS = `id, kind, title, teaser, body_markdown, hero_image_id, source_label, source_url,
  related_sources, valid_from, valid_to, eligible_for_daily, video, support_service_ids`;

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
   * Items flagged `eligible_for_daily`, whatever their window. Which of them a given day may show is
   * a rule of the daily selection (`isWithinWindow`), not of the table: a yearly window cannot be
   * compared as one string range.
   */
  async listEligibleForDaily(
    executor: SqliteExecutor = this.database,
  ): Promise<ContentItemRecord[]> {
    const rows = await executor.query<ContentItemRow>(
      `SELECT ${COLUMNS} FROM content_items WHERE eligible_for_daily = 1 ORDER BY id ASC`,
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
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        toValues(record),
      );
      return;
    }

    await executor.run(
      `UPDATE content_items
       SET kind = ?, title = ?, teaser = ?, body_markdown = ?, hero_image_id = ?, source_label = ?,
           source_url = ?, related_sources = ?, valid_from = ?, valid_to = ?, eligible_for_daily = ?,
           video = ?, support_service_ids = ?
       WHERE id = ?`,
      [
        record.kind,
        record.title,
        record.teaser,
        record.bodyMarkdown,
        record.heroImageId,
        record.sourceLabel,
        record.sourceUrl,
        serializeRelatedSources(record.relatedSources),
        record.validFrom,
        record.validTo,
        record.eligibleForDaily ? 1 : 0,
        serializeVideo(record.video),
        serializeSupportServiceIds(record.supportServiceIds),
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
    record.heroImageId,
    record.sourceLabel,
    record.sourceUrl,
    serializeRelatedSources(record.relatedSources),
    record.validFrom,
    record.validTo,
    record.eligibleForDaily ? 1 : 0,
    serializeVideo(record.video),
    serializeSupportServiceIds(record.supportServiceIds),
  ];
}

function toRecord(row: ContentItemRow): ContentItemRecord {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    teaser: row.teaser,
    bodyMarkdown: row.body_markdown,
    heroImageId: row.hero_image_id ?? null,
    sourceLabel: row.source_label ?? null,
    sourceUrl: row.source_url ?? null,
    relatedSources: deserializeRelatedSources(row.related_sources),
    validFrom: row.valid_from ?? null,
    validTo: row.valid_to ?? null,
    eligibleForDaily: row.eligible_for_daily === 1,
    video: row.video === null ? null : (JSON.parse(row.video) as VideoRecord),
    supportServiceIds:
      row.support_service_ids === null ? null : (JSON.parse(row.support_service_ids) as string[]),
  };
}

function serializeRelatedSources(sources: readonly RelatedSourceRecord[]): string | null {
  return sources.length === 0 ? null : JSON.stringify(sources);
}

function deserializeRelatedSources(value: string | null): readonly RelatedSourceRecord[] {
  return value === null ? [] : (JSON.parse(value) as RelatedSourceRecord[]);
}

function serializeVideo(video: VideoRecord | null): string | null {
  return video === null ? null : JSON.stringify(video);
}

/** `[]` is stored as such: it is a link to the Anlaufstellen page, not the absence of one. */
function serializeSupportServiceIds(ids: readonly string[] | null): string | null {
  return ids === null ? null : JSON.stringify(ids);
}
