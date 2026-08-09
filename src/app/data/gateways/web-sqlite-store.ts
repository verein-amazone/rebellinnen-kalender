/**
 * The browser side of `@capacitor-community/sqlite`.
 *
 * On the web the plugin has no SQLite of its own: every call is forwarded to the `jeep-sqlite`
 * custom element, which runs `sql.js` (SQLite compiled to WebAssembly) and persists the database in
 * IndexedDB. Nothing works until the element is defined and `initWebStore()` has run.
 *
 * The app itself only ships to iOS and Android. This path exists so `ng serve` and the Playwright
 * suite exercise the real SQL and the real migrations instead of a stand-in that could drift from
 * them. It is loaded lazily and only on the web, so a native build never fetches this chunk. The
 * `sql-wasm.wasm` asset is copied by every build (see angular.json) because CI runs the e2e suite
 * against the production bundle served statically.
 *
 * `sql.js` is not a direct dependency: the wasm must match the Emscripten glue bundled inside
 * `jeep-sqlite`, so pnpm hoists jeep-sqlite's own `sql.js` and an override in pnpm-workspace.yaml
 * keeps it on the newest version that actually links (a newer `sql-wasm.wasm` next to the older
 * glue aborts with a `LinkError` and the database never opens). Re-check the override on every
 * jeep-sqlite upgrade; the reminders e2e specs fail loudly on a mismatch.
 */
import type { SQLiteConnection } from '@capacitor-community/sqlite';

/** Where `jeep-sqlite` looks for `sql-wasm.wasm`; see the build assets in angular.json. */
const WASM_PATH = '/assets';

let initialization: Promise<void> | null = null;

/** Idempotent: the element is created once per document, no matter how often this is called. */
export function initializeWebSqliteStore(sqlite: SQLiteConnection): Promise<void> {
  initialization ??= initialize(sqlite).catch((cause: unknown) => {
    initialization = null;
    throw cause;
  });

  return initialization;
}

async function initialize(sqlite: SQLiteConnection): Promise<void> {
  const { defineCustomElements } = await import('jeep-sqlite/loader');
  defineCustomElements();

  await customElements.whenDefined('jeep-sqlite');

  const element = document.createElement('jeep-sqlite');
  // Attributes rather than properties: the element parses them in its own lifecycle hook, so they
  // have to be in place before it is connected.
  //
  // No `autoSave`: `SqliteGateway` already persists explicitly after every `run()` and after every
  // `transaction()` commit (`persistWebStore()`), so it is redundant — and actively harmful.
  // `transaction()` issues `BEGIN IMMEDIATE;`/`COMMIT;` as plain statements with the plugin's own
  // `transaction` flag off (see the comment there), so jeep-sqlite's `isTransactionActive`
  // bookkeeping never learns a transaction is open. With `autoSave` on, jeep-sqlite still reacts to
  // that flag being false and calls `saveToStore()` — which exports the live sql.js database —
  // after *every intermediate statement inside the transaction*, including the ones between BEGIN
  // and COMMIT. That export silently ends the manually-opened transaction, so the later `COMMIT;`
  // fails with "cannot commit - no transaction is active" even though the writes already landed
  // via SQLite's autocommit. Discovered via e2e/support/calendar-seed.ts while adding coverage for
  // #19: every write through `CalendarRepository` (create/update/delete an appointment) uses
  // `transaction()` and hit this on the web platform, which is also what the e2e suite runs
  // against — iOS and Android never load jeep-sqlite and are unaffected either way.
  element.setAttribute('wasmPath', WASM_PATH);
  document.body.appendChild(element);

  await sqlite.initWebStore();
}
