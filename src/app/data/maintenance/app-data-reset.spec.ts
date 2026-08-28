import { TestBed } from '@angular/core/testing';

import { SQLITE_DATABASE } from '../gateways/sqlite-database';
import { InMemorySqliteDatabase } from '../gateways/sqlite-database.testing';
import { MIGRATIONS } from '../migrations/migrations';
import { AppDataReset } from './app-data-reset';

describe('AppDataReset', () => {
  let database: InMemorySqliteDatabase;
  let reset: AppDataReset;

  beforeEach(async () => {
    localStorage.clear();
    database = new InMemorySqliteDatabase();
    database.migrate(MIGRATIONS);

    await database.run(
      `INSERT INTO content_items (id, kind, title, teaser, body_markdown, eligible_for_daily)
       VALUES ('wi-01', 'wissensimpulse', 'W', 'w', 'w', 1)`,
    );
    await database.run(
      `INSERT INTO bookmarks (content_item_id, created_at) VALUES ('wi-01', '2027-02-05T00:00:00.000Z')`,
    );

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: SQLITE_DATABASE, useValue: database }],
    });

    reset = TestBed.inject(AppDataReset);
  });

  afterEach(() => {
    database.close();
  });

  it('empties every application table', async () => {
    await reset.clearEverything();

    for (const table of ['content_items', 'bookmarks', 'reminders']) {
      const rows = await database.query<{ count: number }>(
        `SELECT COUNT(*) AS count FROM ${table}`,
      );
      expect(rows[0]?.count).toBe(0);
    }
  });

  it('keeps the schema, so the app carries on against the same database', async () => {
    await reset.clearEverything();

    const tables = await database.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    );

    expect(tables.map((table) => table.name)).toContain('content_items');
  });

  it('removes the app’s own localStorage entries and leaves everything else alone', async () => {
    localStorage.setItem('rk.dailyImpulse', '{}');
    localStorage.setItem('rk.appearance', '{}');
    localStorage.setItem('unrelated', 'keep me');

    await reset.clearEverything();

    expect(localStorage.getItem('rk.dailyImpulse')).toBeNull();
    expect(localStorage.getItem('rk.appearance')).toBeNull();
    expect(localStorage.getItem('unrelated')).toBe('keep me');
  });
});
