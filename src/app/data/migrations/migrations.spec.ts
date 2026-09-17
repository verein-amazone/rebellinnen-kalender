import { InMemorySqliteDatabase } from '../gateways/sqlite-database.testing';
import { CREATE_REMINDERS } from './001-create-reminders';
import { ADD_REMINDER_POSITION } from './002-add-reminder-position';
import { REPAIR_ALL_DAY_END } from './016-repair-all-day-end';
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

  describe('the all-day end repair', () => {
    /** Everything up to, but not including, the repair - the schema as the buggy form wrote it. */
    async function setupBeforeRepair(): Promise<InMemorySqliteDatabase> {
      const database = new InMemorySqliteDatabase();
      database.migrate(MIGRATIONS.filter((migration) => migration.toVersion < 16));

      const now = '2026-09-10T08:00:00.000Z';
      await database.run(
        `INSERT INTO calendar_sources (id, type, name, enabled, state, created_at, updated_at)
         VALUES ('src-app', 'app', 'App', 1, 'ok', ?, ?), ('src-device', 'device', 'Gerät', 1, 'ok', ?, ?)`,
        [now, now, now, now],
      );
      await database.run(
        `INSERT INTO calendars (id, source_id, name, color, emoji, enabled, writable, external_id, created_at, updated_at)
         VALUES ('cal-1', 'src-app', 'Mein Kalender', NULL, NULL, 1, 1, NULL, ?, ?)`,
        [now, now],
      );

      const item = (
        id: string,
        startKind: string,
        startValue: string,
        endKind: string,
        endValue: string,
      ) =>
        database.run(
          `INSERT INTO app_items (
             id, calendar_id, kind, title, location, note, start_kind, start_value, start_tz,
             end_kind, end_value, end_tz, rrule, predecessor_series_id, rule_revision, created_at, updated_at
           ) VALUES (?, 'cal-1', 'event', ?, NULL, NULL, ?, ?, NULL, ?, ?, NULL, NULL, NULL, 0, ?, ?)`,
          [id, id, startKind, startValue, endKind, endValue, now, now],
        );

      await item('one-day', 'date', '2026-09-18', 'date', '2026-09-19');
      await item('three-days', 'date', '2026-09-18', 'date', '2026-09-21');
      await item('timed', 'zoned', '2026-09-18T09:00:00', 'zoned', '2026-09-18T10:00:00');
      await database.run(
        `INSERT INTO app_item_exceptions (
           series_id, original_start, status, title, location, note, start_kind, start_value, start_tz,
           end_kind, end_value, end_tz, created_at, updated_at
         ) VALUES ('three-days', '2026-09-18', 'override', NULL, NULL, NULL, NULL, NULL, NULL, 'date', '2026-09-20', NULL, ?, ?)`,
        [now, now],
      );

      await database.run(
        `INSERT INTO source_coverage (source_id, window_start_utc, window_end_utc, engine_version, updated_at)
         VALUES ('src-app', ?, ?, 'rrule-temporal@1.0.0', ?), ('src-device', ?, ?, 'rrule-temporal@1.0.0', ?)`,
        [now, now, now, now, now, now],
      );

      return database;
    }

    it('moves an all-day end back to the last day the appointment actually covers', async () => {
      const database = await setupBeforeRepair();

      database.migrate([REPAIR_ALL_DAY_END]);

      const rows = await database.query<{ readonly id: string; readonly end_value: string }>(
        `SELECT id, end_value FROM app_items ORDER BY id`,
      );
      expect(rows).toEqual([
        { id: 'one-day', end_value: '2026-09-18' },
        { id: 'three-days', end_value: '2026-09-20' },
        { id: 'timed', end_value: '2026-09-18T10:00:00' },
      ]);

      database.close();
    });

    it("repairs an exception through its series' start kind, since it has none of its own", async () => {
      const database = await setupBeforeRepair();

      database.migrate([REPAIR_ALL_DAY_END]);

      const [exception] = await database.query<{ readonly end_value: string }>(
        `SELECT end_value FROM app_item_exceptions`,
      );
      expect(exception?.end_value).toBe('2026-09-19');

      database.close();
    });

    it('leaves an already-correct row alone when it is migrated twice over', async () => {
      const database = await setupBeforeRepair();

      database.migrate([REPAIR_ALL_DAY_END]);
      // A shipped migration never runs twice on a device; this only proves the guard is the reason.
      database.migrate([REPAIR_ALL_DAY_END]);

      const [row] = await database.query<{ readonly end_value: string }>(
        `SELECT end_value FROM app_items WHERE id = 'one-day'`,
      );
      expect(row?.end_value).toBe('2026-09-18');

      database.close();
    });

    it('marks only the app sources for a rebuild of their materialized rows', async () => {
      const database = await setupBeforeRepair();

      database.migrate([REPAIR_ALL_DAY_END]);

      const coverage = await database.query<{
        readonly source_id: string;
        readonly engine_version: string;
      }>(`SELECT source_id, engine_version FROM source_coverage ORDER BY source_id`);
      expect(coverage).toEqual([
        { source_id: 'src-app', engine_version: 'repair-016-all-day-end' },
        { source_id: 'src-device', engine_version: 'rrule-temporal@1.0.0' },
      ]);

      database.close();
    });
  });
});
