import { DatabaseSync } from 'node:sqlite';

import type { Migration } from '../migrations/migration';
import {
  SynchronousSqliteDatabase,
  upgradeSchema,
  type SynchronousSqliteEngine,
} from './synchronous-sqlite';

function nodeEngine(database: DatabaseSync): SynchronousSqliteEngine {
  return {
    exec: (statement) => database.exec(statement),
    all: (statement, values) => database.prepare(statement).all(...values),
    run: (statement, values) => {
      database.prepare(statement).run(...values);
    },
  };
}

/**
 * The core the web build runs over `@sqlite.org/sqlite-wasm`. `afterWrite` is how that build saves
 * the database, so when it runs is what decides whether a write survives a reload.
 */
describe('SynchronousSqliteDatabase', () => {
  let raw: DatabaseSync;
  let saves: number;
  let database: SynchronousSqliteDatabase;

  beforeEach(() => {
    raw = new DatabaseSync(':memory:');
    raw.exec('CREATE TABLE entries (id TEXT PRIMARY KEY NOT NULL)');
    saves = 0;
    database = new SynchronousSqliteDatabase(nodeEngine(raw), async () => {
      saves++;
    });
  });

  afterEach(() => {
    raw.close();
  });

  it('saves after a write, so the write survives a reload', async () => {
    await database.run('INSERT INTO entries (id) VALUES (?)', ['a']);

    expect(saves).toBe(1);
  });

  it('does not save after a read', async () => {
    await database.query('SELECT id FROM entries');

    expect(saves).toBe(0);
  });

  it('saves a transaction once, after its commit', async () => {
    await database.transaction(async (tx) => {
      await tx.run('INSERT INTO entries (id) VALUES (?)', ['a']);
      await tx.run('INSERT INTO entries (id) VALUES (?)', ['b']);
    });

    expect(saves).toBe(1);
  });

  it('never saves a rolled-back transaction', async () => {
    await expect(
      database.transaction(async (tx) => {
        await tx.run('INSERT INTO entries (id) VALUES (?)', ['a']);
        throw new Error('validation failed');
      }),
    ).rejects.toThrow('validation failed');

    expect(saves).toBe(0);
    await expect(database.query('SELECT id FROM entries')).resolves.toEqual([]);
  });

  it('holds a concurrent write back until an open transaction has committed', async () => {
    let releaseWork!: () => void;
    const workGate = new Promise<void>((resolve) => (releaseWork = resolve));

    const transaction = database.transaction(async (tx) => {
      await workGate;
      await tx.run('INSERT INTO entries (id) VALUES (?)', ['in-transaction']);
      throw new Error('abort');
    });
    // Without the lock this write would join the open transaction and be rolled back with it.
    const write = database.run('INSERT INTO entries (id) VALUES (?)', ['concurrent']);
    await new Promise((resolve) => setTimeout(resolve, 0));
    releaseWork();

    await expect(transaction).rejects.toThrow('abort');
    await write;
    await expect(database.query('SELECT id FROM entries')).resolves.toEqual([{ id: 'concurrent' }]);
  });
});

describe('upgradeSchema', () => {
  const migrations: readonly Migration[] = [
    { toVersion: 1, statements: ['CREATE TABLE one (id TEXT);'] },
    { toVersion: 2, statements: ['CREATE TABLE two (id TEXT);'] },
  ];

  function version(raw: DatabaseSync): number {
    return (raw.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
  }

  it('applies every migration to an empty database and stamps the newest version', () => {
    const raw = new DatabaseSync(':memory:');

    upgradeSchema(nodeEngine(raw), migrations);

    expect(version(raw)).toBe(2);
    raw.close();
  });

  it('applies only the migrations above the stamped version', () => {
    const raw = new DatabaseSync(':memory:');
    raw.exec('CREATE TABLE one (id TEXT); PRAGMA user_version = 1;');

    // Re-running version 1 would fail: its table already exists.
    expect(() => upgradeSchema(nodeEngine(raw), migrations)).not.toThrow();
    expect(version(raw)).toBe(2);
    raw.close();
  });

  it('leaves the database on the previous version when a migration fails', () => {
    const raw = new DatabaseSync(':memory:');

    expect(() =>
      upgradeSchema(nodeEngine(raw), [
        ...migrations,
        { toVersion: 3, statements: ['CREATE TABLE three (id TEXT);', 'NOT SQL;'] },
      ]),
    ).toThrow();
    expect(version(raw)).toBe(2);
    expect(raw.prepare("SELECT name FROM sqlite_master WHERE name = 'three'").all()).toEqual([]);
    raw.close();
  });
});
