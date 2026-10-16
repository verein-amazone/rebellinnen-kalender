import { IDBFactory } from 'fake-indexeddb';
import 'fake-indexeddb/auto';

type SnapshotModule = typeof import('./web-sqlite-snapshot');

const nodeStructuredClone = globalThis.structuredClone;

/**
 * `fake-indexeddb` stores values with `structuredClone`, which in the test runner is Node's: it
 * returns a Node `Uint8Array`, not the test environment's, and `instanceof` tells them apart. A
 * browser clones within one realm, so the copy here is made in the test's own.
 */
function sameRealmClone<T>(value: T): T {
  return (value instanceof Uint8Array ? value.slice() : nodeStructuredClone(value)) as T;
}

/**
 * A fresh copy of the module over an empty IndexedDB: the module keeps its connection for the whole
 * page, so each test needs its own.
 */
async function freshSnapshots(): Promise<SnapshotModule> {
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('structuredClone', sameRealmClone);
  vi.resetModules();
  return import('./web-sqlite-snapshot');
}

describe('web SQLite snapshot', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has no snapshot before the first write', async () => {
    const { readSnapshot } = await freshSnapshots();

    await expect(readSnapshot('rk.sqlite')).resolves.toBeNull();
  });

  it('reads back the bytes last written under a name, and only under that name', async () => {
    const { readSnapshot, writeSnapshot } = await freshSnapshots();

    await writeSnapshot('rk.sqlite', new Uint8Array([1, 2, 3]));
    await writeSnapshot('rk.sqlite', new Uint8Array([4, 5]));

    await expect(readSnapshot('rk.sqlite')).resolves.toEqual(new Uint8Array([4, 5]));
    await expect(readSnapshot('pr-12.rk.sqlite')).resolves.toBeNull();
  });

  it('tries to open the store again after a failed open, instead of failing for good', async () => {
    const { readSnapshot, writeSnapshot } = await freshSnapshots();
    const open = vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
      throw new Error('IndexedDB is blocked');
    });

    await expect(readSnapshot('rk.sqlite')).rejects.toThrow('IndexedDB is blocked');
    await writeSnapshot('rk.sqlite', new Uint8Array([7]));

    await expect(readSnapshot('rk.sqlite')).resolves.toEqual(new Uint8Array([7]));
    expect(open).toHaveBeenCalledTimes(2);
  });
});
