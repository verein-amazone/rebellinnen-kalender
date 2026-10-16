/**
 * Global test setup, registered as `setupFiles` in angular.json.
 *
 * Node 26 defines a global `localStorage` that is unusable without the `--localstorage-file` flag,
 * and it shadows the storage jsdom installs on the same global object. Web storage therefore reads
 * as `undefined` in tests even though jsdom provides a working implementation. Point the globals
 * back at jsdom's so `data/stores/` can be tested against the real Web Storage API.
 */
const jsdomGlobals = globalThis as unknown as {
  _localStorage?: Storage;
  _sessionStorage?: Storage;
};

for (const [name, storage] of [
  ['localStorage', jsdomGlobals._localStorage],
  ['sessionStorage', jsdomGlobals._sessionStorage],
] as const) {
  if (storage !== undefined) {
    Object.defineProperty(globalThis, name, { value: storage, configurable: true });
  }
}

/**
 * The app formats dates through Angular's `DatePipe`/`formatDate` with the pinned German locale
 * (see `app.config.ts`). The locale data has to be registered here too, because specs build
 * components without the application config. Specs rendering a `DatePipe` also provide
 * `{ provide: LOCALE_ID, useValue: 'de' }`.
 */
import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';

registerLocaleData(localeDe);
