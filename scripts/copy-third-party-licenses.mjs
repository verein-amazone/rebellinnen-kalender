#!/usr/bin/env node
// Angular's `extractLicenses` build option (angular.json, production configuration) writes
// `3rdpartylicenses.txt` next to `dist/rebellinnen-kalender/browser/`, not inside it - but
// `browser/` is the only directory that ships as `webDir` to Capacitor and is the app's own web
// root at runtime. `LegalContentGateway.fetchThirdPartyLicenses()` fetches it from there, so a
// build without this copy step ships an app whose "Open-Source-Lizenzen" screen 404s. Run as the
// `build` script's `postbuild` hook; a no-op (not an error) in development builds, which don't
// extract licenses at all.
import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const outputRoot = join(import.meta.dirname, '..', 'dist', 'rebellinnen-kalender');
const source = join(outputRoot, '3rdpartylicenses.txt');
const destination = join(outputRoot, 'browser', '3rdpartylicenses.txt');

if (existsSync(source)) {
  copyFileSync(source, destination);
}
