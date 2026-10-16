import { InMemorySqliteDatabase } from './sqlite-database.testing';

/**
 * The double stands in for the gateway in every DAO and repository spec, so its transaction
 * semantics have to match the real contract: all-or-nothing, reads inside see uncommitted writes.
 */
describe('InMemorySqliteDatabase', () => {
  let database: InMemorySqliteDatabase;

  beforeEach(async () => {
    database = new InMemorySqliteDatabase();
    await database.run('CREATE TABLE entries (id TEXT PRIMARY KEY NOT NULL)');
  });

  afterEach(() => {
    database.close();
  });

  it('commits all statements of a transaction together', async () => {
    await database.transaction(async (tx) => {
      await tx.run('INSERT INTO entries (id) VALUES (?)', ['a']);
      await tx.run('INSERT INTO entries (id) VALUES (?)', ['b']);
    });

    await expect(database.query('SELECT id FROM entries ORDER BY id')).resolves.toEqual([
      { id: 'a' },
      { id: 'b' },
    ]);
  });

  it('rolls everything back when the callback throws', async () => {
    await database.run('INSERT INTO entries (id) VALUES (?)', ['existing']);

    await expect(
      database.transaction(async (tx) => {
        await tx.run('DELETE FROM entries');
        await tx.run('INSERT INTO entries (id) VALUES (?)', ['replacement']);
        throw new Error('validation failed');
      }),
    ).rejects.toThrow('validation failed');

    await expect(database.query('SELECT id FROM entries')).resolves.toEqual([{ id: 'existing' }]);
  });

  it('lets reads inside the transaction see its own uncommitted writes', async () => {
    const seen = await database.transaction(async (tx) => {
      await tx.run('INSERT INTO entries (id) VALUES (?)', ['a']);
      return tx.query('SELECT id FROM entries');
    });

    expect(seen).toEqual([{ id: 'a' }]);
  });
});
