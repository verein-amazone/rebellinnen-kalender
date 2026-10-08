#!/usr/bin/env node
// Reads the hand-written German release notes for one version, if there are any.
//
// A release from `main` reaches the public stores, where the English commit subjects that
// semantic-release collects are the wrong text for Verein Amazone's users. For such a version,
// `docs/release-notes/<version>.md` holds German notes written by hand (see
// docs/release-notes/README.md). Prereleases from `dev` have no such file and keep the generated
// notes.
//
// Two consumers:
//
// - semantic-release runs the CLI as `generateNotesCmd` (.releaserc.json). Whatever it prints is
//   appended to the generated notes, so the GitHub release and CHANGELOG.md carry the German text
//   too. For a version without a file it prints nothing.
// - scripts/build-store-release-notes.mjs imports `readHandWrittenReleaseNotes` and uses the text
//   instead of the generated notes for both stores.
//
//   node scripts/hand-written-release-notes.mjs 1.0.0
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const NOTES_DIR = join(import.meta.dirname, '..', 'docs', 'release-notes');

/**
 * The hand-written notes for `version`, or `null` when the version has none.
 *
 * @param {string} version A version without the `v` prefix, `1.0.0`.
 * @returns {string | null}
 */
export function readHandWrittenReleaseNotes(version) {
  const path = join(NOTES_DIR, `${version}.md`);
  if (!existsSync(path)) {
    return null;
  }

  const notes = readFileSync(path, 'utf8').trim();
  return notes === '' ? null : notes;
}

if (import.meta.main) {
  const version = process.argv[2];
  if (version === undefined) {
    console.error('Usage: node scripts/hand-written-release-notes.mjs <version>');
    process.exit(1);
  }

  const notes = readHandWrittenReleaseNotes(version.replace(/^v/, ''));
  if (notes !== null) {
    process.stdout.write(`${notes}\n`);
  }
}
