#!/usr/bin/env node
// Checks the store listings in fastlane/ against what App Store Connect and the Play Console accept.
//
// The listings are uploaded only by a release from `main` (docs/store-listing.md), after the tag is
// cut. A description one character too long, a screenshot at the wrong size or a feature graphic
// with an alpha channel would fail there, when the version has already been released on GitHub.
// This script fails on the pull request instead; CI runs it next to the native-version check.
//
//   node scripts/check-store-listing.mjs
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import sharp from 'sharp';

import { toPlainText } from './build-store-release-notes.mjs';

const ROOT = join(import.meta.dirname, '..');
const METADATA = join(ROOT, 'fastlane', 'metadata');
const APP_STORE_LOCALE = join(METADATA, 'de-DE');
const PLAY_LOCALE = join(METADATA, 'android', 'de-DE');
const APP_STORE_SCREENSHOTS = join(ROOT, 'fastlane', 'screenshots', 'de-DE');
const RELEASE_NOTES = join(ROOT, 'docs', 'release-notes');

/** Field limits in characters, as both consoles count them: Unicode code points. */
const APP_STORE_FIELDS = {
  'name.txt': 30,
  'subtitle.txt': 30,
  'promotional_text.txt': 170,
  'description.txt': 4000,
  'keywords.txt': 100,
};
const APP_STORE_URLS = ['support_url.txt', 'marketing_url.txt', 'privacy_url.txt'];
const PLAY_FIELDS = {
  'title.txt': 30,
  'short_description.txt': 80,
  'full_description.txt': 4000,
};
const PLAY_CHANGELOG_LIMIT = 500;

/**
 * The Play Data safety answers (`android listing` in fastlane/Fastfile). Play's CSV import knows its
 * columns by these exact headers and needs the top question answered whatever else the file says.
 */
const DATA_SAFETY_CSV = join(METADATA, 'android', 'data_safety.csv');
const DATA_SAFETY_HEADER =
  'Question ID (machine readable),Response ID (machine readable),Response value,Answer requirement,Human-friendly question label';
const DATA_SAFETY_TOP_QUESTION = 'PSL_DATA_COLLECTION_COLLECTS_PERSONAL_DATA';

/** The 6.9" iPhone size; App Store Connect scales it down for every smaller iPhone. */
const APP_STORE_SCREENSHOT = { width: 1320, height: 2868, min: 1, max: 10 };
/** Play: 2-8 phone screenshots, each side 320-3840 px, the long side at most twice the short one. */
const PLAY_SCREENSHOTS = { min: 2, max: 8, minSide: 320, maxSide: 3840, maxRatio: 2 };

/** @type {string[]} */
const problems = [];

/**
 * @param {string} path
 * @returns {string}
 */
function display(path) {
  return relative(ROOT, path);
}

/**
 * @param {string} path
 * @returns {string | null}
 */
function readText(path) {
  if (!existsSync(path)) {
    problems.push(`${display(path)} is missing`);
    return null;
  }
  return readFileSync(path, 'utf8');
}

/**
 * @param {string} path
 * @param {number} limit
 * @param {{ strict?: boolean }} [options] `strict`: the file is uploaded byte for byte (supply), so
 *   surrounding whitespace counts and a final newline would become part of the listing.
 */
function checkField(path, limit, options = {}) {
  const raw = readText(path);
  if (raw === null) {
    return;
  }
  const text = options.strict ? raw : raw.trim();
  const length = [...text].length;

  if (text.trim() === '') {
    problems.push(`${display(path)} is empty`);
  }
  if (length > limit) {
    problems.push(`${display(path)} is ${length} characters; the store accepts ${limit}`);
  }
  if (options.strict && raw !== raw.trimEnd()) {
    problems.push(`${display(path)} ends in whitespace or a newline, which Play would show`);
  }
}

/** @param {string} path */
function checkUrl(path) {
  const raw = readText(path);
  if (raw === null) {
    return;
  }
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'https:') {
      problems.push(`${display(path)} is not an https URL`);
    }
  } catch {
    problems.push(`${display(path)} is not a URL`);
  }
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function pngsIn(dir) {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir)
    .filter((name) => name.endsWith('.png'))
    .sort()
    .map((name) => join(dir, name));
}

/**
 * @param {string} path
 * @returns {Promise<{ width: number, height: number, hasAlpha: boolean }>}
 */
async function imageInfo(path) {
  const { width = 0, height = 0, hasAlpha = false } = await sharp(path).metadata();
  return { width, height, hasAlpha };
}

/**
 * @param {string} path
 * @param {{ width: number, height: number, alpha: boolean }} expected
 */
async function checkImage(path, expected) {
  if (!existsSync(path)) {
    problems.push(`${display(path)} is missing`);
    return;
  }
  const { width, height, hasAlpha } = await imageInfo(path);
  if (width !== expected.width || height !== expected.height) {
    problems.push(
      `${display(path)} is ${width}×${height}; it must be ${expected.width}×${expected.height}`,
    );
  }
  if (hasAlpha && !expected.alpha) {
    problems.push(`${display(path)} has an alpha channel, which the store rejects`);
  }
}

/**
 * @param {string} dir
 * @param {{ min: number, max: number }} count
 */
function checkCount(dir, count) {
  const found = pngsIn(dir).length;
  if (found < count.min || found > count.max) {
    problems.push(
      `${display(dir)} has ${found} screenshots; the store takes ${count.min}-${count.max}`,
    );
  }
}

async function main() {
  for (const [file, limit] of Object.entries(APP_STORE_FIELDS)) {
    checkField(join(APP_STORE_LOCALE, file), limit);
  }
  for (const file of APP_STORE_URLS) {
    checkUrl(join(APP_STORE_LOCALE, file));
  }
  for (const [file, limit] of Object.entries(PLAY_FIELDS)) {
    checkField(join(PLAY_LOCALE, file), limit, { strict: true });
  }

  const dataSafety = readText(DATA_SAFETY_CSV);
  if (dataSafety !== null) {
    const [header, ...rows] = dataSafety.trim().split(/\r?\n/);
    if (header !== DATA_SAFETY_HEADER) {
      problems.push(`${display(DATA_SAFETY_CSV)} does not start with Play's CSV header`);
    }
    const top = rows.map((row) => row.split(',')).find(([id]) => id === DATA_SAFETY_TOP_QUESTION);
    if (top === undefined || !['TRUE', 'FALSE'].includes(top[2])) {
      problems.push(
        `${display(DATA_SAFETY_CSV)} has to answer ${DATA_SAFETY_TOP_QUESTION} with TRUE or FALSE`,
      );
    }
  }

  // Hand-written release notes become the Play changelog unchanged (build-store-release-notes.mjs),
  // which fails the release on too long a text; better to know when the file is written.
  if (existsSync(RELEASE_NOTES)) {
    for (const name of readdirSync(RELEASE_NOTES).filter((n) => /^\d+\.\d+\.\d+\.md$/.test(n))) {
      const path = join(RELEASE_NOTES, name);
      const length = toPlainText(readFileSync(path, 'utf8')).length;
      if (length > PLAY_CHANGELOG_LIMIT) {
        problems.push(
          `${display(path)} is ${length} characters as plain text; Play accepts ${PLAY_CHANGELOG_LIMIT}`,
        );
      }
    }
  }

  checkCount(APP_STORE_SCREENSHOTS, APP_STORE_SCREENSHOT);
  for (const path of pngsIn(APP_STORE_SCREENSHOTS)) {
    await checkImage(path, { ...APP_STORE_SCREENSHOT, alpha: false });
  }

  const phoneScreenshots = join(PLAY_LOCALE, 'images', 'phoneScreenshots');
  checkCount(phoneScreenshots, PLAY_SCREENSHOTS);
  for (const path of pngsIn(phoneScreenshots)) {
    const { width, height, hasAlpha } = await imageInfo(path);
    const short = Math.min(width, height);
    const long = Math.max(width, height);
    if (short < PLAY_SCREENSHOTS.minSide || long > PLAY_SCREENSHOTS.maxSide) {
      problems.push(`${display(path)} is ${width}×${height}; each side must be 320-3840 px`);
    }
    if (long > short * PLAY_SCREENSHOTS.maxRatio) {
      problems.push(`${display(path)} is ${width}×${height}; Play allows at most 2:1`);
    }
    if (hasAlpha) {
      problems.push(`${display(path)} has an alpha channel, which the store rejects`);
    }
  }

  await checkImage(join(PLAY_LOCALE, 'images', 'featureGraphic.png'), {
    width: 1024,
    height: 500,
    alpha: false,
  });
  await checkImage(join(PLAY_LOCALE, 'images', 'icon.png'), {
    width: 512,
    height: 512,
    alpha: true,
  });

  if (problems.length > 0) {
    console.error(`The store listing would be rejected:\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  console.log('The store listing fits both stores.');
}

await main();
