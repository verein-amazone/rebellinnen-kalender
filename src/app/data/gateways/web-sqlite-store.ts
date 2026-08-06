/**
 * The browser side of `@capacitor-community/sqlite`.
 *
 * On the web the plugin has no SQLite of its own: every call is forwarded to the `jeep-sqlite`
 * custom element, which runs `sql.js` (SQLite compiled to WebAssembly) and persists the database in
 * IndexedDB. Nothing works until the element is defined and `initWebStore()` has run.
 *
 * The app itself only ships to iOS and Android. This path exists so `ng serve` and the Playwright
 * suite exercise the real SQL and the real migrations instead of a stand-in that could drift from
 * them. It is loaded lazily and only on the web, so a native build never fetches this chunk, and the
 * `sql-wasm.wasm` asset is copied only by the development build — a production web build therefore
 * cannot open a database, deliberately.
 *
 * `sql.js` is pinned to an exact version in package.json for a reason: `jeep-sqlite` bundles the
 * Emscripten glue of the `sql.js` release it was built against, and a newer `sql-wasm.wasm` next to
 * that older glue fails to instantiate with a `LinkError`. Upgrade the two together, and check the
 * Today page in the browser afterwards.
 */
import type { SQLiteConnection } from '@capacitor-community/sqlite';

/** Where `jeep-sqlite` looks for `sql-wasm.wasm`; see the development assets in angular.json. */
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
  element.setAttribute('autoSave', 'true');
  element.setAttribute('wasmPath', WASM_PATH);
  document.body.appendChild(element);

  await sqlite.initWebStore();
}
