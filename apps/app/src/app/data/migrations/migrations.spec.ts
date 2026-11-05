import { createHash } from 'node:crypto';

import { InMemorySqliteDatabase } from '../gateways/sqlite-database.testing';
import { CREATE_SCHEMA } from './019-create-schema';
import { REBUILD_CONTENT_ITEMS } from './020-rebuild-content-items';
import { CREATE_SEARCH_INDEX } from './021-search-index';
import { ADD_CONTENT_VIDEO_AND_SUPPORT_LINKS } from './022-content-video-and-support-links';
import { ADD_EVENT_URL_AND_CONFERENCE } from './023-event-url-and-conference';
import { ADD_SYNCED_EVENT_REMINDERS } from './024-synced-event-reminders';
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
  'content_search',
  'ics_item_exceptions',
  'ics_items',
  'ics_subscriptions',
  'occurrences',
  'reminders',
  'source_coverage',
  'support_service_search',
  'support_services',
];

/** The tables version 21 adds, absent from a database that stopped at version 20. */
const SEARCH_TABLES = ['content_search', 'support_service_search', 'support_services'];

async function tableNames(database: InMemorySqliteDatabase): Promise<string[]> {
  const rows = await database.query<{ readonly name: string }>(
    // An FTS5 table keeps its index in shadow tables (`content_search_data`, …). They are the
    // index's storage, not part of the schema a migration declares.
    `SELECT name FROM sqlite_master AS t
     WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
       AND NOT EXISTS (
         SELECT 1 FROM sqlite_master AS v
         WHERE v.type = 'table' AND v.sql LIKE 'CREATE VIRTUAL TABLE%'
           AND t.name IN (v.name || '_data', v.name || '_idx', v.name || '_content',
                          v.name || '_docsize', v.name || '_config')
       )
     ORDER BY name`,
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

  it('indexes the search tables by trigram, so a part of a word matches', async () => {
    const database = new InMemorySqliteDatabase();
    database.migrate(MIGRATIONS);

    await database.run(
      `INSERT INTO support_service_search (support_service_id, name, teaser, region, contacts)
       VALUES ('a', 'frauenberatung perg', '', '', '')`,
    );

    await expect(
      database.query(
        `SELECT support_service_id FROM support_service_search WHERE support_service_search MATCH ?`,
        ['"beratung"'],
      ),
    ).resolves.toEqual([{ support_service_id: 'a' }]);

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
      expect(await tableNames(database)).toEqual(
        TABLES.filter((table) => !SEARCH_TABLES.includes(table)),
      );

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

  describe('version 22 over a version 21 database', () => {
    /** A 1.1.0 database with a content item and a bookmark on it. */
    async function versionTwentyOneDatabase(): Promise<InMemorySqliteDatabase> {
      const database = new InMemorySqliteDatabase();
      await database.run('PRAGMA foreign_keys = ON;');
      database.migrate([CREATE_SCHEMA, REBUILD_CONTENT_ITEMS, CREATE_SEARCH_INDEX]);
      await database.run(
        `INSERT INTO content_items (id, kind, title, teaser, body_markdown, hero_image_id,
          valid_from, valid_to, eligible_for_daily, related_sources)
         VALUES ('wi-08', 'wissensimpulse', 'Kampftag', 'Teaser', 'Text', 'kampftag',
          '2027-03-08', '2027-03-08', 1, NULL)`,
      );
      await database.run(
        `INSERT INTO bookmarks (content_item_id, created_at) VALUES ('wi-08', '2026-10-01')`,
      );
      return database;
    }

    it('adds the video and Anlaufstellen columns, empty until the catalog sync fills them', async () => {
      const database = await versionTwentyOneDatabase();
      database.migrate([ADD_CONTENT_VIDEO_AND_SUPPORT_LINKS]);
      database.migrate([ADD_CONTENT_VIDEO_AND_SUPPORT_LINKS]);

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
        'video',
        'support_service_ids',
      ]);
      expect(
        await database.query(
          `SELECT id, hero_image_id, valid_from, video, support_service_ids FROM content_items`,
        ),
      ).toEqual([
        {
          id: 'wi-08',
          hero_image_id: 'kampftag',
          valid_from: '2027-03-08',
          video: null,
          support_service_ids: null,
        },
      ]);

      database.close();
    });

    it('keeps the bookmarks, still bound to their item', async () => {
      const database = await versionTwentyOneDatabase();
      database.migrate([ADD_CONTENT_VIDEO_AND_SUPPORT_LINKS]);

      expect(await database.query(`SELECT * FROM bookmarks`)).toEqual([
        { content_item_id: 'wi-08', created_at: '2026-10-01' },
      ]);
      await expect(async () =>
        database.run(`INSERT INTO bookmarks (content_item_id, created_at) VALUES ('gone', 'x')`),
      ).rejects.toThrow('FOREIGN KEY');

      database.close();
    });
  });

  describe('version 23 over a version 22 database', () => {
    /** A 1.1.0 database with a device occurrence, an ICS item and its subscription. */
    async function versionTwentyTwoDatabase(): Promise<InMemorySqliteDatabase> {
      const database = new InMemorySqliteDatabase();
      database.migrate([
        CREATE_SCHEMA,
        REBUILD_CONTENT_ITEMS,
        CREATE_SEARCH_INDEX,
        ADD_CONTENT_VIDEO_AND_SUPPORT_LINKS,
      ]);
      await database.run(
        `INSERT INTO occurrences (id, source_id, source_type, calendar_id, provenance, item_kind,
          title, location, is_all_day, start_kind, start_value, start_utc, end_utc,
          start_local_day, end_local_day, external_id, description)
         VALUES ('device:e1', 'device', 'device', 'cal-1', 'device-cached', 'event', 'Stand-up',
          NULL, 0, 'utc', '2026-11-05T08:00:00Z', '2026-11-05T08:00:00Z', '2026-11-05T09:00:00Z',
          '2026-11-05', '2026-11-05', 'e1', 'Agenda')`,
      );
      await database.run(
        `INSERT INTO ics_subscriptions (id, url, etag, last_modified, raw_ics, created_at, updated_at)
         VALUES ('sub-1', 'https://example.org/basic.ics', '"abc"', 'Wed, 04 Nov 2026 10:00:00 GMT',
          'BEGIN:VCALENDAR', '2026-11-01', '2026-11-04')`,
      );
      await database.run(
        `INSERT INTO ics_items (subscription_id, uid, revision_id, kind, title, note, start_kind,
          start_value)
         VALUES ('sub-1', 'u1', 'rev-1', 'event', 'Plenum', 'Notiz', 'date', '2026-11-05')`,
      );
      return database;
    }

    it('adds the URL and join-link columns, keeping every row, and survives running twice', async () => {
      const database = await versionTwentyTwoDatabase();
      database.migrate([ADD_EVENT_URL_AND_CONFERENCE]);
      database.migrate([ADD_EVENT_URL_AND_CONFERENCE]);

      expect((await columnNames(database, 'occurrences')).slice(-3)).toEqual([
        'description',
        'url',
        'conference_url',
      ]);
      expect((await columnNames(database, 'ics_items')).slice(-3)).toEqual([
        'rrule',
        'url',
        'conference_url',
      ]);
      expect(
        await database.query(`SELECT id, title, description, url, conference_url FROM occurrences`),
      ).toEqual([
        {
          id: 'device:e1',
          title: 'Stand-up',
          description: 'Agenda',
          url: null,
          conference_url: null,
        },
      ]);
      expect(await database.query(`SELECT uid, note, url, conference_url FROM ics_items`)).toEqual([
        { uid: 'u1', note: 'Notiz', url: null, conference_url: null },
      ]);
      expect(
        await database.query<{ readonly name: string }>(
          `SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'occurrences' AND name NOT LIKE 'sqlite_%'
           ORDER BY name`,
        ),
      ).toEqual([
        { name: 'idx_occurrences_range' },
        { name: 'idx_occurrences_series' },
        { name: 'idx_occurrences_source' },
      ]);

      database.close();
    });

    it('drops the conditional-request metadata, so the next refresh re-parses each feed', async () => {
      const database = await versionTwentyTwoDatabase();
      database.migrate([ADD_EVENT_URL_AND_CONFERENCE]);

      expect(
        await database.query(`SELECT id, etag, last_modified, raw_ics FROM ics_subscriptions`),
      ).toEqual([{ id: 'sub-1', etag: null, last_modified: null, raw_ics: 'BEGIN:VCALENDAR' }]);

      database.close();
    });
  });

  describe('version 24 over a version 23 database', () => {
    /** A database with a device occurrence carrying a join link, an ICS item and its subscription. */
    async function versionTwentyThreeDatabase(): Promise<InMemorySqliteDatabase> {
      const database = new InMemorySqliteDatabase();
      database.migrate([
        CREATE_SCHEMA,
        REBUILD_CONTENT_ITEMS,
        CREATE_SEARCH_INDEX,
        ADD_CONTENT_VIDEO_AND_SUPPORT_LINKS,
        ADD_EVENT_URL_AND_CONFERENCE,
      ]);
      await database.run(
        `INSERT INTO occurrences (id, source_id, source_type, calendar_id, provenance, item_kind,
          title, is_all_day, start_kind, start_value, start_utc, end_utc, start_local_day,
          end_local_day, external_id, url)
         VALUES ('device:e1', 'device', 'device', 'cal-1', 'device-cached', 'event', 'Stand-up', 0,
          'utc', '2026-11-05T08:00:00Z', '2026-11-05T08:00:00Z', '2026-11-05T09:00:00Z',
          '2026-11-05', '2026-11-05', 'e1', 'https://example.org/standup')`,
      );
      await database.run(
        `INSERT INTO ics_subscriptions (id, url, etag, last_modified, raw_ics, created_at, updated_at)
         VALUES ('sub-1', 'https://example.org/basic.ics', '"abc"', 'Wed, 04 Nov 2026 10:00:00 GMT',
          'BEGIN:VCALENDAR', '2026-11-01', '2026-11-04')`,
      );
      await database.run(
        `INSERT INTO ics_items (subscription_id, uid, revision_id, kind, title, start_kind,
          start_value, conference_url)
         VALUES ('sub-1', 'u1', 'rev-1', 'event', 'Plenum', 'date', '2026-11-05',
          'https://meet.example.org/plenum')`,
      );
      await database.run(
        `INSERT INTO ics_item_exceptions (subscription_id, uid, original_start, revision_id, status,
          title)
         VALUES ('sub-1', 'u1', '2026-11-12', 'rev-1', 'override', 'Plenum (verlegt)')`,
      );
      return database;
    }

    it('adds the reminders columns, keeping every row and column, and survives running twice', async () => {
      const database = await versionTwentyThreeDatabase();
      database.migrate([ADD_SYNCED_EVENT_REMINDERS]);
      database.migrate([ADD_SYNCED_EVENT_REMINDERS]);

      expect((await columnNames(database, 'occurrences')).slice(-2)).toEqual([
        'conference_url',
        'reminders',
      ]);
      expect((await columnNames(database, 'ics_items')).slice(-2)).toEqual([
        'conference_url',
        'reminders',
      ]);
      expect((await columnNames(database, 'ics_item_exceptions')).slice(-2)).toEqual([
        'end_tz',
        'reminders',
      ]);
      expect(
        await database.query(`SELECT original_start, title, reminders FROM ics_item_exceptions`),
      ).toEqual([{ original_start: '2026-11-12', title: 'Plenum (verlegt)', reminders: null }]);
      expect(await database.query(`SELECT id, url, reminders FROM occurrences`)).toEqual([
        { id: 'device:e1', url: 'https://example.org/standup', reminders: null },
      ]);
      expect(await database.query(`SELECT uid, conference_url, reminders FROM ics_items`)).toEqual([
        { uid: 'u1', conference_url: 'https://meet.example.org/plenum', reminders: null },
      ]);
      expect(
        await database.query<{ readonly name: string }>(
          `SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'occurrences' AND name NOT LIKE 'sqlite_%'
           ORDER BY name`,
        ),
      ).toEqual([
        { name: 'idx_occurrences_range' },
        { name: 'idx_occurrences_series' },
        { name: 'idx_occurrences_source' },
      ]);

      database.close();
    });

    it('makes every feed due for a full download, so the next start reads its alarms', async () => {
      const database = await versionTwentyThreeDatabase();
      await database.run(
        `UPDATE ics_subscriptions SET last_success_at = '2026-11-04', last_checked_at = '2026-11-05'`,
      );
      database.migrate([ADD_SYNCED_EVENT_REMINDERS]);

      expect(
        await database.query(
          `SELECT id, etag, last_modified, last_success_at, last_checked_at FROM ics_subscriptions`,
        ),
      ).toEqual([
        {
          id: 'sub-1',
          etag: null,
          last_modified: null,
          last_success_at: '2026-11-04',
          last_checked_at: '1970-01-01T00:00:00Z',
        },
      ]);

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
