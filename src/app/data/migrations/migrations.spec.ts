import { InMemorySqliteDatabase } from '../gateways/sqlite-database.testing';
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
    ]);
    // The completion state is the timestamp alone, so it is the one column allowed to be empty.
    expect(columns.filter((column) => column.notnull === 0).map((column) => column.name)).toEqual([
      'completed_at',
    ]);
    expect(columns.find((column) => column.name === 'id')?.pk).toBe(1);
    expect(indexes.map((index) => index.name)).toContain('idx_reminders_order');

    database.close();
  });
});
