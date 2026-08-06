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
  readonly position: number;
}

/** One entry's new place in the manual order. */
export interface PositionAssignment {
  readonly id: string;
  readonly position: number;
}

/** The lowest and highest position of one section, or nulls when that section is empty. */
export interface PositionRange {
  readonly min: number | null;
  readonly max: number | null;
}

const COLUMNS = 'id, text, completed_at, created_at, updated_at, position';

/**
 * Table access for the „Nicht vergessen“ list.
 *
 * No business rules live here: identifiers, timestamps and positions are passed in, so the caller
 * decides what „now“ means and where an entry belongs, and this stays testable. Every value is bound
 * as a parameter.
 */
@Injectable({ providedIn: 'root' })
export class ReminderDao {
  private readonly database = inject(SQLITE_DATABASE);

  /**
   * Open entries first, each group in the manual order the user arranged. `created_at` only breaks a
   * tie between two identical positions, so the result is stable no matter how the rows are stored.
   */
  async listAll(): Promise<ReminderRecord[]> {
    const rows = await this.database.query<ReminderRow>(
      `SELECT ${COLUMNS} FROM reminders
       ORDER BY (completed_at IS NULL) DESC, position ASC, created_at ASC`,
    );

    return rows.map(toRecord);
  }

  async insert(record: ReminderRecord): Promise<void> {
    await this.database.run(`INSERT INTO reminders (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?)`, [
      record.id,
      record.text,
      record.completedAt,
      record.createdAt,
      record.updatedAt,
      record.position,
    ]);
  }

  async updateText(id: string, text: string, updatedAt: string): Promise<void> {
    await this.database.run(`UPDATE reminders SET text = ?, updated_at = ? WHERE id = ?`, [
      text,
      updatedAt,
      id,
    ]);
  }

  /**
   * Completing or reopening an entry moves it into the other section, so it always needs a new
   * position there. Both are written in one statement: a half-applied move would leave the entry
   * ordered by a position that belongs to the section it just left.
   */
  async updateCompletion(
    id: string,
    completedAt: string | null,
    position: number,
    updatedAt: string,
  ): Promise<void> {
    await this.database.run(
      `UPDATE reminders SET completed_at = ?, position = ?, updated_at = ? WHERE id = ?`,
      [completedAt, position, updatedAt, id],
    );
  }

  async updatePosition(id: string, position: number, updatedAt: string): Promise<void> {
    await this.database.run(`UPDATE reminders SET position = ?, updated_at = ? WHERE id = ?`, [
      position,
      updatedAt,
      id,
    ]);
  }

  /**
   * Rewrites several positions at once, for the rare case where the fractional positions have grown
   * too close to fit another entry between them.
   *
   * One statement on purpose: the database contract has no transactions, so a loop of updates could
   * be interrupted halfway and leave the section in an order nobody asked for. Only the number of
   * placeholders is built into the SQL; every value is still bound.
   */
  async reassignPositions(
    assignments: readonly PositionAssignment[],
    updatedAt: string,
  ): Promise<void> {
    if (assignments.length === 0) {
      return;
    }

    const cases = assignments.map(() => `WHEN ? THEN ?`).join(' ');
    const ids = assignments.map(() => `?`).join(', ');

    await this.database.run(
      `UPDATE reminders SET position = CASE id ${cases} END, updated_at = ? WHERE id IN (${ids})`,
      [
        ...assignments.flatMap((assignment) => [assignment.id, assignment.position]),
        updatedAt,
        ...assignments.map((assignment) => assignment.id),
      ],
    );
  }

  /**
   * The bounds of one section, so the caller can put an entry above the first or below the last one
   * without reading every row.
   *
   * The `IS NULL` test cannot be a bound parameter, so the two variants are two literal statements
   * picked by the flag — no value is ever interpolated.
   */
  async selectPositionRange(completed: boolean): Promise<PositionRange> {
    const rows = await this.database.query<{
      readonly min_position: number | null;
      readonly max_position: number | null;
    }>(
      completed
        ? `SELECT MIN(position) AS min_position, MAX(position) AS max_position
           FROM reminders WHERE completed_at IS NOT NULL`
        : `SELECT MIN(position) AS min_position, MAX(position) AS max_position
           FROM reminders WHERE completed_at IS NULL`,
    );

    return { min: rows[0]?.min_position ?? null, max: rows[0]?.max_position ?? null };
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
    position: row.position,
  };
}
