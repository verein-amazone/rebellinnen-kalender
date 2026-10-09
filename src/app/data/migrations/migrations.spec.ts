import { InMemorySqliteDatabase } from '../gateways/sqlite-database.testing';
import { CREATE_SCHEMA } from './019-create-schema';
import { DATABASE_VERSION, MIGRATIONS } from './migrations';

interface TableInfoRow {
  readonly name: string;
  readonly notnull: number;
  readonly pk: number;
}

/** The highest version a pre-release build ever left on a device. */
const LAST_PRE_RELEASE_VERSION = 18;

const TABLES = [
  'app_item_exceptions',
  'app_items',
  'bookmarks',
  'calendar_sources',
  'calendars',
  'content_items',
  'ics_item_exceptions',
  'ics_items',
  'ics_subscriptions',
  'occurrences',
  'reminders',
  'source_coverage',
];

async function tableNames(database: InMemorySqliteDatabase): Promise<string[]> {
  const rows = await database.query<{ readonly name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  return rows.map((row) => row.name);
}

async function columnNames(database: InMemorySqliteDatabase, table: string): Promise<string[]> {
  const columns = await database.query<TableInfoRow>(`PRAGMA table_info(${table})`);
  return columns.map((column) => column.name);
}

describe('MIGRATIONS', () => {
  it('reports the highest version as the database version', () => {
    const highest = MIGRATIONS.reduce(
      (version, migration) => Math.max(version, migration.toVersion),
      0,
    );

    expect(DATABASE_VERSION).toBe(highest);
  });

  it('numbers the versions upwards from the baseline without gaps or duplicates', () => {
    const versions = MIGRATIONS.map((migration) => migration.toVersion);

    expect(versions).toEqual(
      Array.from({ length: MIGRATIONS.length }, (_, index) => CREATE_SCHEMA.toVersion + index),
    );
  });

  it('starts above every pre-release version, so a tester device still upgrades', () => {
    // The plugin only upgrades: a database already at the requested version or above it is opened
    // unchanged. A baseline at or below a pre-release version would skip that device for good.
    expect(CREATE_SCHEMA.toVersion).toBeGreaterThan(LAST_PRE_RELEASE_VERSION);
  });

  it('creates every table on an empty database', async () => {
    const database = new InMemorySqliteDatabase();
    database.migrate(MIGRATIONS);

    expect(await tableNames(database)).toEqual(TABLES);

    database.close();
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

  describe('over a pre-release database', () => {
    /**
     * A tester's database as an early pre-release build left it: some of the tables, filled,
     * referencing each other, and without the columns later versions added.
     */
    async function preReleaseDatabase(): Promise<InMemorySqliteDatabase> {
      const database = new InMemorySqliteDatabase();
      // The plugin turns foreign keys on, which is what makes the drop order matter.
      await database.run('PRAGMA foreign_keys = ON;');
      database.migrate([
        {
          toVersion: 10,
          statements: [
            `CREATE TABLE reminders (id TEXT PRIMARY KEY NOT NULL, text TEXT NOT NULL);`,
            `CREATE TABLE calendar_sources (id TEXT PRIMARY KEY NOT NULL);`,
            `CREATE TABLE calendars (
              id        TEXT PRIMARY KEY NOT NULL,
              source_id TEXT NOT NULL REFERENCES calendar_sources (id)
            );`,
            `CREATE TABLE app_items (
              id          TEXT PRIMARY KEY NOT NULL,
              calendar_id TEXT NOT NULL REFERENCES calendars (id)
            );`,
            `CREATE TABLE content_items (id TEXT PRIMARY KEY NOT NULL);`,
            `CREATE TABLE bookmarks (
              content_item_id TEXT PRIMARY KEY NOT NULL REFERENCES content_items (id)
            );`,
            `INSERT INTO reminders VALUES ('r', 'Milch');`,
            `INSERT INTO calendar_sources VALUES ('s');`,
            `INSERT INTO calendars VALUES ('c', 's');`,
            `INSERT INTO app_items VALUES ('i', 'c');`,
            `INSERT INTO content_items VALUES ('k');`,
            `INSERT INTO bookmarks VALUES ('k');`,
          ],
        },
      ]);
      return database;
    }

    it('replaces it with the full schema', async () => {
      const database = await preReleaseDatabase();
      database.migrate(MIGRATIONS);

      expect(await tableNames(database)).toEqual(TABLES);
      expect(await columnNames(database, 'app_items')).toContain('reminders');
      expect(await columnNames(database, 'reminders')).toContain('position');

      database.close();
    });

    it('discards the pre-release data, children before the tables they reference', async () => {
      const database = await preReleaseDatabase();
      database.migrate(MIGRATIONS);

      for (const table of TABLES) {
        const [{ count }] = await database.query<{ readonly count: number }>(
          `SELECT COUNT(*) AS count FROM ${table}`,
        );
        expect(count, table).toBe(0);
      }

      database.close();
    });
  });
});
