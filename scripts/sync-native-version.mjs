#!/usr/bin/env node
// Writes `package.json`'s version into the iOS and Android version fields.
//
// The version exists in four native places - `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` in
// the Xcode project (Debug and Release each), `versionName` and `versionCode` in the Gradle build -
// and none of them used to be linked to anything. semantic-release runs this as part of a release
// (see `.releaserc.json`), so `package.json` stays the single source of truth, exactly as
// `generate-app-version.mjs` treats it. `--check` verifies instead of writing and is run in CI.
//
// ## The store version and the build number
//
//     shortVersion = major.minor.patch                      (any `-rc.N` suffix stripped)
//     buildNumber  = (major * 10000 + minor * 100 + patch) * 1000 + suffix
//     suffix       = N for a prerelease `1.2.3-rc.N`, RELEASE_SUFFIX for a release off `main`
//
//     1.0.0-rc.4 -> 10000004      1.0.1-rc.1 -> 10001001
//     1.0.0      -> 10000999      1.1.0-rc.1 -> 10100001
//
// The build number reads back as its version (`10203004` is `1.2.3` build `4`), and the reserved
// suffix marks the one build to pick in App Store Connect or the Play console. Both store rules are
// satisfied: the number increases strictly along semver order, which is what Play needs across the
// whole app, and it increases within a single `MARKETING_VERSION` train, which is what App Store
// Connect needs.
//
// Neither store lets a build number go backwards, and the mistake cannot be undone for that app, so
// every constraint below is an assertion rather than a clamp. In particular the Android
// `versionCode` maximum of 2100000000 is the real ceiling on the encoding - which is also why a
// `YYMMDDHHMM` timestamp cannot be used here, it exceeds it outright.
//
// If a store upload fails after the release happened, do not reuse the build number: push an empty
// commit to `dev` to cut the next `rc`, which gets a fresh one.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** The build-number suffix that marks a release rather than a prerelease. */
const RELEASE_SUFFIX = 999;
/** Android rejects a `versionCode` of 2100000000 or more, which caps the encoded version. */
const MAX_ENCODED_VERSION = 2_100_000;

/**
 * Derives the store-facing short version and the native build number from a semver version.
 *
 * @param {string} version A released version, `1.2.3` or `1.2.3-rc.4`.
 * @returns {{ shortVersion: string, buildNumber: number }}
 */
export function deriveNativeVersion(version) {
  const parsed = /^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/.exec(version);
  if (parsed === null) {
    throw new Error(`Not a semver version: ${version}`);
  }

  const [, majorText, minorText, patchText, prerelease] = parsed;
  const [major, minor, patch] = [majorText, minorText, patchText].map(Number);

  // Two digits each, or the encoding below would collide across versions.
  if (minor > 99 || patch > 99) {
    throw new Error(`Minor and patch must stay below 100 to encode a build number: ${version}`);
  }

  const encoded = major * 10000 + minor * 100 + patch;
  if (encoded >= MAX_ENCODED_VERSION) {
    throw new Error(`Version ${version} exceeds the Android versionCode ceiling.`);
  }

  let suffix = RELEASE_SUFFIX;
  if (prerelease !== undefined) {
    const candidate = /^rc\.(\d+)$/.exec(prerelease);
    if (candidate === null) {
      throw new Error(`Only \`rc.N\` prereleases can be mapped to a build number: ${version}`);
    }
    suffix = Number(candidate[1]);
    if (suffix < 1 || suffix >= RELEASE_SUFFIX) {
      throw new Error(`Prerelease number must be between 1 and ${RELEASE_SUFFIX - 1}: ${version}`);
    }
  }

  return { shortVersion: `${major}.${minor}.${patch}`, buildNumber: encoded * 1000 + suffix };
}

/**
 * Writes the derived version into the native projects, or reports drift when `checkOnly` is set.
 *
 * @param {boolean} checkOnly
 * @returns {string[]} The paths whose version fields do not match `package.json`.
 */
function syncNativeVersion(checkOnly) {
  const root = join(import.meta.dirname, '..');
  const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const { shortVersion, buildNumber } = deriveNativeVersion(version);

  // The expected counts are asserted below: Xcode carries both settings once per build
  // configuration, Gradle once each. A future Capacitor or Xcode version reshaping these files has
  // to fail loudly rather than silently write nothing.
  const targets = [
    {
      path: join(root, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj'),
      replacements: [
        {
          pattern: /MARKETING_VERSION = [^;]+;/g,
          replacement: `MARKETING_VERSION = ${shortVersion};`,
          occurrences: 2,
        },
        {
          pattern: /CURRENT_PROJECT_VERSION = [^;]+;/g,
          replacement: `CURRENT_PROJECT_VERSION = ${buildNumber};`,
          occurrences: 2,
        },
      ],
    },
    {
      path: join(root, 'android', 'app', 'build.gradle'),
      replacements: [
        {
          pattern: /^(\s*)versionName ".*"$/gm,
          replacement: `$1versionName "${shortVersion}"`,
          occurrences: 1,
        },
        {
          pattern: /^(\s*)versionCode .+$/gm,
          replacement: `$1versionCode ${buildNumber}`,
          occurrences: 1,
        },
      ],
    },
  ];

  const drifted = [];

  for (const { path, replacements } of targets) {
    const current = readFileSync(path, 'utf8');
    let updated = current;

    for (const { pattern, replacement, occurrences } of replacements) {
      const found = current.match(pattern)?.length ?? 0;
      if (found !== occurrences) {
        throw new Error(
          `Expected ${occurrences} match(es) of ${pattern} in ${path}, found ${found}.`,
        );
      }
      updated = updated.replace(pattern, replacement);
    }

    if (updated === current) {
      continue;
    }

    if (checkOnly) {
      drifted.push(path);
    } else {
      writeFileSync(path, updated);
    }
  }

  return drifted;
}

if (import.meta.main) {
  const drifted = syncNativeVersion(process.argv.includes('--check'));

  if (drifted.length > 0) {
    console.error(
      'The native version fields no longer match package.json:\n' +
        drifted.map((path) => `  ${path}`).join('\n') +
        '\nRun `node scripts/sync-native-version.mjs` to fix them.',
    );
    process.exit(1);
  }
}
