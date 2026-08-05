import { inject, Injectable } from '@angular/core';

import type { ReminderRecord } from '../entities/reminder.record';
import { SQLITE_DATABASE } from '../gateways/sqlite-database';

/** The database shape of a `reminders` row. */
interface ReminderRow {
  readonly id: string;
  readonly text: string;
  readonly completed_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

const COLUMNS = 'id, text, completed_at, created_at, updated_at';

/**
 * Table access for the „Nicht vergessen“ list.
 *
 * No business rules live here: identifiers and timestamps are passed in, so the caller decides what
 * „now“ means and this stays testable. Every value is bound as a parameter.
 */
@Injectable({ providedIn: 'root' })
export class ReminderDao {
  private readonly database = inject(SQLITE_DATABASE);

  /**
   * Open entries first, each group in the order the entries were created. A completed entry moves
   * down once and then stays where it is, which matters more here than showing recent changes first.
   */
  async listAll(): Promise<ReminderRecord[]> {
    const rows = await this.database.query<ReminderRow>(
      `SELECT ${COLUMNS} FROM reminders ORDER BY (completed_at IS NULL) DESC, created_at ASC`,
    );

    return rows.map(toRecord);
  }

  async insert(record: ReminderRecord): Promise<void> {
    await this.database.run(`INSERT INTO reminders (${COLUMNS}) VALUES (?, ?, ?, ?, ?)`, [
      record.id,
      record.text,
      record.completedAt,
      record.createdAt,
      record.updatedAt,
    ]);
  }

  async updateText(id: string, text: string, updatedAt: string): Promise<void> {
    await this.database.run(`UPDATE reminders SET text = ?, updated_at = ? WHERE id = ?`, [
      text,
      updatedAt,
      id,
    ]);
  }

  async updateCompletedAt(
    id: string,
    completedAt: string | null,
    updatedAt: string,
  ): Promise<void> {
    await this.database.run(`UPDATE reminders SET completed_at = ?, updated_at = ? WHERE id = ?`, [
      completedAt,
      updatedAt,
      id,
    ]);
  }

  async delete(id: string): Promise<void> {
    await this.database.run(`DELETE FROM reminders WHERE id = ?`, [id]);
  }
}

/**
 * `completed_at` is normalised explicitly: an absent column arrives as `undefined` on some platforms
 * and as `null` on others, and the record type promises one of the two.
 */
function toRecord(row: ReminderRow): ReminderRecord {
  return {
    id: row.id,
    text: row.text,
    completedAt: row.completed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
