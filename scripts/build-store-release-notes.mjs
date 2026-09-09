#!/usr/bin/env node
// Turns the release notes semantic-release already wrote into the two store formats.
//
// #66 asked whether the generated notes can double as the store release notes. They can, because
// both stores read them from a file: `pilot` takes the TestFlight "What to Test" text as a string,
// and `supply` reads `fastlane/metadata/android/<locale>/changelogs/<versionCode>.txt`. This script
// is the bridge - it reads the body of the GitHub release the tag already carries, flattens the
// markdown to something a tester can read on a phone, and writes both files.
//
// The two stores cap the text at very different lengths (App Store Connect 4000 characters, Play
// 500), so the Play text is the one that usually gets truncated - always on a line boundary, so a
// changelog never ends mid-sentence.
//
// Both texts open with a German line naming the version, because the readers are Verein Amazone's
// testers; the generated notes below it stay in the English of the commit subjects. Hand-written
// German release notes for the public release are #91 and #74, not this script.
//
//   node scripts/build-store-release-notes.mjs --tag v1.0.0-rc.2
//   node scripts/build-store-release-notes.mjs --tag v1.0.0-rc.2 --dry-run
//   node scripts/build-store-release-notes.mjs --tag v1.0.0-rc.2 --body-file notes.md
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { deriveNativeVersion } from './sync-native-version.mjs';

/** App Store Connect rejects a "What to Test" text longer than this. */
const TESTFLIGHT_LIMIT = 4000;
/** Play rejects a changelog longer than this. */
const PLAY_LIMIT = 500;
/** The Play listing's default language; `supply` only accepts locales the listing actually has. */
const PLAY_LOCALE = 'de-DE';

/**
 * Flattens semantic-release's markdown notes to plain text.
 *
 * @param {string} markdown The body of the GitHub release.
 * @returns {string}
 */
export function toPlainText(markdown) {
  const lines = [];

  for (const rawLine of markdown.replaceAll('\r\n', '\n').split('\n')) {
    // `# [1.0.0-rc.2](…compare…)` / `## [1.0.1](…)` - the version title, which the lead-in below
    // states more readably. Deeper headings are the section names ("Bug Fixes") and are kept.
    if (/^#{1,2}\s/.test(rawLine)) {
      continue;
    }

    let line = rawLine.replace(/^#{3,}\s*/, '');
    // The commit reference every bullet ends with: `([1a2b3c4](https://github.com/…/commit/…))`.
    line = line.replace(/\s*\(\[[0-9a-f]{6,}\]\([^)]*\)\)/g, '');
    // Any remaining markdown link keeps its text and loses its URL.
    line = line.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
    line = line.replaceAll('**', '').replaceAll('`', '');
    line = line.replace(/^\*\s+/, '- ');

    lines.push(line.trimEnd());
  }

  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Shortens `text` to at most `limit` characters, cutting at a line boundary.
 *
 * @param {string} text
 * @param {number} limit
 * @returns {string}
 */
export function truncateToLimit(text, limit) {
  if (text.length <= limit) {
    return text;
  }

  const marker = '\n…';
  const candidate = text.slice(0, limit - marker.length);
  const lastBreak = candidate.lastIndexOf('\n');

  return (lastBreak > 0 ? candidate.slice(0, lastBreak) : candidate).trimEnd() + marker;
}

/**
 * Builds both store texts for one released version.
 *
 * @param {string} version The released version, `1.0.0` or `1.0.0-rc.2`.
 * @param {string} markdown The body of the GitHub release.
 * @returns {{ testflight: string, play: string, buildNumber: number }}
 */
export function buildStoreReleaseNotes(version, markdown) {
  const { shortVersion, buildNumber } = deriveNativeVersion(version);
  const isPrerelease = version !== shortVersion;
  const leadIn = isPrerelease
    ? `Testversion ${version} (Build ${buildNumber})`
    : `Version ${shortVersion} (Build ${buildNumber})`;

  const body = toPlainText(markdown);
  const full = body === '' ? leadIn : `${leadIn}\n\n${body}`;

  return {
    testflight: truncateToLimit(full, TESTFLIGHT_LIMIT),
    play: truncateToLimit(full, PLAY_LIMIT),
    buildNumber,
  };
}

/**
 * Reads the body of a GitHub release. `gh` is authenticated in CI by `GH_TOKEN`.
 *
 * @param {string} tag
 * @returns {string}
 */
function readReleaseBody(tag) {
  return execFileSync('gh', ['release', 'view', tag, '--json', 'body', '--jq', '.body'], {
    encoding: 'utf8',
  });
}

/**
 * @param {string[]} argv
 * @returns {Record<string, string | boolean>}
 */
function parseArguments(argv) {
  /** @type {Record<string, string | boolean>} */
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith('--')) {
      throw new Error(`Unexpected argument: ${argument}`);
    }

    const name = argument.slice(2);
    if (name === 'dry-run') {
      options[name] = true;
      continue;
    }

    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`--${name} requires a value`);
    }
    options[name] = value;
    index += 1;
  }

  return options;
}

if (import.meta.main) {
  const options = parseArguments(process.argv.slice(2));
  const tag = options.tag;
  if (typeof tag !== 'string') {
    console.error(
      'Usage: node scripts/build-store-release-notes.mjs --tag <tag> [--body-file <path>] ' +
        '[--out-dir <dir>] [--dry-run]',
    );
    process.exit(1);
  }

  const root = join(import.meta.dirname, '..');
  const markdown =
    typeof options['body-file'] === 'string'
      ? readFileSync(options['body-file'], 'utf8')
      : readReleaseBody(tag);

  const version = tag.replace(/^v/, '');
  const { testflight, play, buildNumber } = buildStoreReleaseNotes(version, markdown);

  const outDir =
    typeof options['out-dir'] === 'string'
      ? options['out-dir']
      : join(root, 'build', 'store-release-notes');
  const testflightPath = join(outDir, 'testflight.txt');
  const playPath = join(
    root,
    'fastlane',
    'metadata',
    'android',
    PLAY_LOCALE,
    'changelogs',
    `${buildNumber}.txt`,
  );

  if (options['dry-run'] === true) {
    console.log(`--- ${testflightPath} (${testflight.length}/${TESTFLIGHT_LIMIT})\n${testflight}`);
    console.log(`\n--- ${playPath} (${play.length}/${PLAY_LIMIT})\n${play}`);
  } else {
    for (const [path, contents] of [
      [testflightPath, testflight],
      [playPath, play],
    ]) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, `${contents}\n`);
    }
    console.log(`Wrote ${testflightPath} and ${playPath}`);
  }
}
