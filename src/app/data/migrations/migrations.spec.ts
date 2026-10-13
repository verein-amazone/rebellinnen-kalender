import { createHash } from 'node:crypto';

import { InMemorySqliteDatabase } from '../gateways/sqlite-database.testing';
import { CREATE_SCHEMA } from './019-create-schema';
import { REBUILD_CONTENT_ITEMS } from './020-rebuild-content-items';
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

  it('never changes a migration that has shipped', () => {
    // A device that applied a migration never runs it again, so an edit would only reach fresh
    // installs. Add a migration with the next version instead; append its hash here when it ships.
    const shipped: Record<number, string> = {
      19: 'db6eed6e1d8b048dfd4702179d7f9aff59467616753084da8b94d166cd05d290',
    };

    for (const migration of MIGRATIONS.filter((entry) => entry.toVersion in shipped)) {
      const hash = createHash('sha256').update(JSON.stringify(migration.statements)).digest('hex');
      expect(hash, `migration ${migration.toVersion}`).toBe(shipped[migration.toVersion]);
    }
  });

  it('can apply every migration a second time', async () => {
    // The plugin commits a migration's statements and only then stamps the new version, in a
    // separate step. A crash in between runs the migration again on the next launch, so running it
    // twice must succeed - or every later launch fails to open the database.
    const database = new InMemorySqliteDatabase();
    database.migrate(MIGRATIONS);

    expect(() => database.migrate(MIGRATIONS)).not.toThrow();
    expect(await tableNames(database)).toEqual(TABLES);

    database.close();
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

  describe('version 20 over a version 19 database', () => {
    /** A 1.0.0 database with a content item in the old shape and a bookmark on it. */
    async function versionNineteenDatabase(): Promise<InMemorySqliteDatabase> {
      const database = new InMemorySqliteDatabase();
      await database.run('PRAGMA foreign_keys = ON;');
      database.migrate([CREATE_SCHEMA]);
      await database.run(
        `INSERT INTO content_items (id, kind, title, teaser, body_markdown, image_path,
          image_attribution, image_alt, daily_render, eligible_for_daily, related_sources)
         VALUES ('reb-09', 'rebellin', 'Ada Lovelace', 'Teaser', 'Text', '/content/reb-09.webp',
          'Bild: Alfred Edward Chalon', 'Gemaltes Porträt', 'image', 1, '[]')`,
      );
      await database.run(
        `INSERT INTO bookmarks (content_item_id, created_at) VALUES ('reb-09', '2026-10-01')`,
      );
      return database;
    }

    it('names the picture by its image id and drops the columns the image catalog replaced', async () => {
      const database = await versionNineteenDatabase();
      database.migrate([REBUILD_CONTENT_ITEMS]);

      expect(await columnNames(database, 'content_items')).toEqual([
        'id',
        'kind',
        'title',
        'teaser',
        'body_markdown',
        'hero_image_id',
        'source_label',
        'source_url',
        'valid_from',
        'valid_to',
        'eligible_for_daily',
        'related_sources',
      ]);
      expect(await tableNames(database)).toEqual(TABLES);

      database.close();
    });

    it('keeps the content and the bookmarks on it, still bound to their item', async () => {
      const database = await versionNineteenDatabase();
      database.migrate([REBUILD_CONTENT_ITEMS]);
      database.migrate([REBUILD_CONTENT_ITEMS]);

      expect(
        await database.query(
          `SELECT id, title, hero_image_id, eligible_for_daily FROM content_items`,
        ),
      ).toEqual([
        {
          id: 'reb-09',
          title: 'Ada Lovelace',
          // Filled by the catalog sync, which the catalog version shipping with it triggers.
          hero_image_id: null,
          eligible_for_daily: 1,
        },
      ]);
      expect(await database.query(`SELECT * FROM bookmarks`)).toEqual([
        { content_item_id: 'reb-09', created_at: '2026-10-01' },
      ]);
      expect(
        await database.query<{ readonly table: string }>(`PRAGMA foreign_key_list(bookmarks)`),
      ).toEqual([expect.objectContaining({ table: 'content_items' })]);
      await expect(async () =>
        database.run(`INSERT INTO bookmarks (content_item_id, created_at) VALUES ('gone', 'x')`),
      ).rejects.toThrow('FOREIGN KEY');

      database.close();
    });
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
