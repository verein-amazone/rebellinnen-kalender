/**
 * Where the web build keeps its database between page loads: one IndexedDB record holding the
 * whole SQLite file, written after every committed write (see `WasmSqliteGateway`).
 *
 * The same durability model `jeep-sqlite` gave the web build before, and enough for what the web
 * build is for - `ng serve`, the Playwright suite and the demo. The app itself ships to iOS and
 * Android, where the plugin writes a real file.
 *
 * Plain IndexedDB rather than `localStorage`: the file is binary, and a database with a few months of
 * materialised occurrences outgrows `localStorage`'s quota.
 */

const STORE = 'databases';

/** The IndexedDB database holding the snapshots. Not itself scoped - the record key is. */
const IDB_NAME = 'rk-sqlite';

let connection: Promise<IDBDatabase> | null = null;

/** Opened once per page and kept open: a snapshot is written after every write. */
function openStore(): Promise<IDBDatabase> {
  connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB could not be opened.'));
  }).catch((cause: unknown) => {
    connection = null;
    throw cause;
  });

  return connection;
}

function settle<T>(request: IDBRequest<T>, transaction: IDBTransaction): Promise<T> {
  return new Promise((resolve, reject) => {
    // Resolve on the transaction's `complete`, not the request's `success`: only then is a write
    // durable, and a reload right after it must find it.
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error ?? request.error);
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB write aborted.'));
  });
}

/** The saved database file, or `null` when nothing was saved under `name` yet. */
export async function readSnapshot(name: string): Promise<Uint8Array | null> {
  const transaction = (await openStore()).transaction(STORE, 'readonly');
  const value: unknown = await settle(transaction.objectStore(STORE).get(name), transaction);
  return value instanceof Uint8Array ? value : null;
}

export async function writeSnapshot(name: string, bytes: Uint8Array): Promise<void> {
  const transaction = (await openStore()).transaction(STORE, 'readwrite');
  await settle(transaction.objectStore(STORE).put(bytes, name), transaction);
}
