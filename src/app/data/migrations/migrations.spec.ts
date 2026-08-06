import { InMemorySqliteDatabase } from '../gateways/sqlite-database.testing';
import { CREATE_REMINDERS } from './001-create-reminders';
import { ADD_REMINDER_POSITION } from './002-add-reminder-position';
import { DATABASE_VERSION, MIGRATIONS } from './migrations';

interface TableInfoRow {
  readonly name: string;
  readonly notnull: number;
  readonly pk: number;
}

describe('MIGRATIONS', () => {
  it('reports the highest version as the database version', () => {
    const highest = MIGRATIONS.reduce(
      (version, migration) => Math.max(version, migration.toVersion),
      0,
    );

    expect(DATABASE_VERSION).toBe(highest);
  });

  it('numbers the versions from 1 without gaps or duplicates', () => {
    const versions = MIGRATIONS.map((migration) => migration.toVersion);

    expect(versions).toEqual(Array.from({ length: MIGRATIONS.length }, (_, index) => index + 1));
  });

  it('creates the reminders table with its ordering index', async () => {
    const database = new InMemorySqliteDatabase();
    database.migrate(MIGRATIONS);

    const columns = await database.query<TableInfoRow>(`PRAGMA table_info(reminders)`);
    const indexes = await database.query<{ readonly name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'reminders'`,
    );

    expect(columns.map((column) => column.name)).toEqual([
      'id',
      'text',
      'completed_at',
      'created_at',
      'updated_at',
      'position',
    ]);
    // The completion state is the timestamp alone, so it is the one column allowed to be empty.
    expect(columns.filter((column) => column.notnull === 0).map((column) => column.name)).toEqual([
      'completed_at',
    ]);
    expect(columns.find((column) => column.name === 'id')?.pk).toBe(1);
    expect(indexes.map((index) => index.name)).toContain('idx_reminders_order');

    database.close();
  });

  it('backfills the positions in the order version 1 read the list in', async () => {
    const database = new InMemorySqliteDatabase();
    database.migrate([CREATE_REMINDERS]);

    // Deliberately inserted out of order, and with one pair sharing a `created_at`, so the backfill
    // cannot pass by accident.
    const rows: readonly [string, string | null, string][] = [
      ['done-late', '2026-08-05T18:00:00.000Z', '2026-08-02T09:00:00.000Z'],
      ['open-second', null, '2026-08-03T09:00:00.000Z'],
      ['done-early', '2026-08-04T18:00:00.000Z', '2026-08-01T09:00:00.000Z'],
      ['open-first', null, '2026-08-03T08:00:00.000Z'],
    ];
    for (const [id, completedAt, createdAt] of rows) {
      await database.run(
        `INSERT INTO reminders (id, text, completed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [id, id, completedAt, createdAt, createdAt],
      );
    }

    const before = await database.query<{ readonly id: string }>(
      `SELECT id FROM reminders ORDER BY (completed_at IS NULL) DESC, created_at ASC`,
    );

    database.migrate([ADD_REMINDER_POSITION]);

    const after = await database.query<{ readonly id: string }>(
      `SELECT id FROM reminders ORDER BY (completed_at IS NULL) DESC, position ASC`,
    );

    expect(after).toEqual(before);
    expect(after.map((row) => row.id)).toEqual([
      'open-first',
      'open-second',
      'done-early',
      'done-late',
    ]);

    database.close();
  });
});
