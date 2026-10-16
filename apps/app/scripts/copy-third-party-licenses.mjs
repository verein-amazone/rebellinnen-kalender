#!/usr/bin/env node
// Angular's `extractLicenses` build option (angular.json, production configuration) writes
// `3rdpartylicenses.txt` next to `dist/rebellinnen-kalender/browser/`, not inside it - but
// `browser/` is the only directory that ships as `webDir` to Capacitor and is the app's own web
// root at runtime. `LegalContentGateway.fetchThirdPartyLicenses()` fetches it from there, so a
// build without this copy step ships an app whose "Open-Source-Lizenzen" screen 404s. Run as the
// `build` script's `postbuild` hook; a no-op (not an error) in development builds, which don't
// extract licenses at all.
//
// Angular sees only the JavaScript it bundles. The copy therefore appends
// licenses/additional-third-party-licenses.txt - the Android and iOS libraries, copied assets and
// fonts (scripts/build-third-party-licenses.mjs) - and then checks every licence in the result
// against licenses/policy.json. A dependency under a licence nobody has allowed fails the build
// here, before it can ship (#11).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import satisfies from 'spdx-satisfies';

const ROOT = join(import.meta.dirname, '..');
const outputRoot = join(ROOT, 'dist', 'rebellinnen-kalender');
const source = join(outputRoot, '3rdpartylicenses.txt');
const destination = join(outputRoot, 'browser', '3rdpartylicenses.txt');
const additional = join(ROOT, 'licenses', 'additional-third-party-licenses.txt');
const policy = JSON.parse(readFileSync(join(ROOT, 'licenses', 'policy.json'), 'utf8'));

/**
 * Every `Package:` with the `License:` line that follows it, in the format both files share.
 *
 * @param {string} text
 * @returns {{ name: string, license: string }[]}
 */
function packages(text) {
  return [...text.matchAll(/^Package: (.+)\nLicense: (.*)$/gm)].map(([, name, license]) => ({
    name,
    license: license.replace(/^"(.*)"$/, '$1'),
  }));
}

/**
 * Why a package's licence may not ship, or null when it may.
 *
 * @param {{ name: string, license: string }} pkg
 * @param {{ allowed: string[], approved: Record<string, { license: string }> }} rules
 * @returns {string | null}
 */
function violation({ name, license }, rules) {
  if (rules.approved[name]?.license === license) {
    return null;
  }
  try {
    return satisfies(license, rules.allowed) ? null : `${name}: "${license}" is not allowed`;
  } catch {
    return `${name}: "${license}" is not an SPDX licence expression`;
  }
}

function main() {
  if (!existsSync(source)) {
    return;
  }
  const merged = readFileSync(source, 'utf8').trimEnd() + '\n' + readFileSync(additional, 'utf8');

  const problems = packages(merged)
    .map((pkg) => violation(pkg, policy))
    .filter((problem) => problem !== null);
  if (problems.length > 0) {
    console.error(
      `Third-party licences outside licenses/policy.json:\n- ${problems.join('\n- ')}\n` +
        'See licenses/README.md for how a licence gets allowed.',
    );
    process.exit(1);
  }

  writeFileSync(destination, merged);
}

main();
