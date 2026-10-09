#!/usr/bin/env node
// Writes licenses/additional-third-party-licenses.txt: the licences of everything the app ships that
// Angular's `extractLicenses` cannot see (#11). Angular lists only the JavaScript it bundles, which
// already covers every Capacitor plugin, native code included - the plugins are npm packages whose
// one licence covers their ios/ and android/ folders as well. Missing from it, and written here:
//
// - the Android libraries Gradle resolves for the release build, from the report of the Licensee
//   Gradle plugin (android/app/build.gradle), plus any NOTICE file inside their JARs and AARs;
// - the remote Swift packages in Package.resolved, with their licence from GitHub at the pinned
//   revision;
// - the Capacitor Android runtime (`@capacitor/android`), which has no JavaScript to bundle - its
//   iOS counterpart is the capacitor-swift-pm package above;
// - npm files that angular.json copies as assets instead of bundling (sql.js's WebAssembly build);
// - the components in licenses/policy.json that no manifest describes: the fonts, and code that is
//   compiled into another binary.
//
// The file is committed, so the web build needs neither Gradle nor the network, and a dependency
// change that alters it shows up in review. scripts/copy-third-party-licenses.mjs appends it to
// Angular's file after every production build and checks every licence against the policy.
//
//   node scripts/build-third-party-licenses.mjs           runs Gradle, then writes the file
//   node scripts/build-third-party-licenses.mjs --check   fails if the committed file is stale
//
// Gradle needs JDK 21. The GitHub API is called without a token unless GITHUB_TOKEN is set, which
// allows 60 requests an hour - plenty for the handful of Swift packages.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const LICENSES = join(ROOT, 'licenses');
const OUTPUT = join(LICENSES, 'additional-third-party-licenses.txt');
const POLICY = JSON.parse(readFileSync(join(LICENSES, 'policy.json'), 'utf8'));
const ANDROID = join(ROOT, 'android');
const LICENSEE_TASK = ':app:licenseeAndroidRelease';
const LICENSEE_REPORT = join(ANDROID, 'app/build/reports/licensee/androidRelease/artifacts.json');
const PACKAGE_RESOLVED = join(
  ROOT,
  'ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved',
);
const GRADLE_CACHE = join(
  process.env.GRADLE_USER_HOME ?? join(homedir(), '.gradle'),
  'caches/modules-2/files-2.1',
);

/** The separator Angular's `extractLicenses` puts between two packages. */
const SEPARATOR = '-'.repeat(80);

const LICENSE_FILE = /(^|\/)(LICEN[CS]E|COPYING)(\.(txt|md))?$/i;
const NOTICE_FILE = /(^|\/)NOTICE(\.(txt|md))?$/i;

/**
 * @typedef {{ name: string, license: string, text: string, notice?: string }} Entry
 */

/**
 * One block in Angular's format, so the merged file reads as one list.
 *
 * @param {Entry} entry
 * @returns {string}
 */
function block(entry) {
  const notice = entry.notice ? `\n\n${entry.notice.trim()}` : '';
  return `${SEPARATOR}\nPackage: ${entry.name}\nLicense: "${entry.license}"\n\n${entry.text.trim()}${notice}\n`;
}

/**
 * @param {string} path relative to licenses/
 * @returns {string}
 */
function policyText(path) {
  return readFileSync(join(LICENSES, path), 'utf8');
}

/**
 * The licence file at the root of an npm package.
 *
 * @param {string} dir
 * @returns {Entry}
 */
function npmPackage(dir) {
  const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const file = readdirSync(dir).find((name) => LICENSE_FILE.test(name));
  if (!file) {
    throw new Error(`${manifest.name} has no licence file in ${relative(ROOT, dir)}`);
  }
  return {
    name: manifest.name,
    license: manifest.license,
    text: readFileSync(join(dir, file), 'utf8'),
  };
}

/**
 * Walks up from a directory inside node_modules to the package root.
 *
 * @param {string} dir
 * @returns {string}
 */
function packageRoot(dir) {
  let current = dir;
  while (!existsSync(join(current, 'package.json'))) {
    const parent = dirname(current);
    if (parent === current) {
      throw new Error(`No package.json above ${dir}`);
    }
    current = parent;
  }
  return current;
}

/** @returns {Entry[]} */
function copiedAssets() {
  const angular = JSON.parse(readFileSync(join(ROOT, 'angular.json'), 'utf8'));
  const assets = Object.values(angular.projects).flatMap(
    (project) => project.architect?.build?.options?.assets ?? [],
  );
  return assets
    .filter((asset) => typeof asset === 'object' && asset.input.startsWith('node_modules/'))
    .map((asset) => npmPackage(packageRoot(join(ROOT, asset.input))));
}

/** @returns {Entry[]} */
function manualComponents() {
  return POLICY.components.map((component) => ({
    name: component.name,
    license: component.license,
    text: policyText(component.text),
    notice: component.notice ? policyText(component.notice) : undefined,
  }));
}

/**
 * @param {string} archive
 * @returns {string[]}
 */
function zipEntries(archive) {
  return execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' }).split('\n').filter(Boolean);
}

/**
 * @param {string} archive
 * @param {string} entry
 * @returns {Buffer}
 */
function zipEntry(archive, entry) {
  return execFileSync('unzip', ['-p', archive, entry], { maxBuffer: 64 * 1024 * 1024 });
}

/**
 * The licence and NOTICE files inside a JAR or AAR, including the JARs nested in an AAR.
 *
 * @param {string} archive
 * @returns {{ licenses: string[], notices: string[] }}
 */
function legalFiles(archive) {
  const licenses = [];
  const notices = [];
  const scratch = mkdtempSync(join(tmpdir(), 'licenses-'));
  try {
    const visit = (/** @type {string} */ path) => {
      for (const entry of zipEntries(path)) {
        if (NOTICE_FILE.test(entry)) {
          notices.push(zipEntry(path, entry).toString('utf8'));
        } else if (LICENSE_FILE.test(entry)) {
          licenses.push(zipEntry(path, entry).toString('utf8'));
        } else if (path === archive && entry.endsWith('.jar')) {
          const nested = join(scratch, `${readdirSync(scratch).length}.jar`);
          writeFileSync(nested, zipEntry(path, entry));
          visit(nested);
        }
      }
    };
    visit(archive);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  return { licenses, notices };
}

/**
 * The JAR or AAR Gradle downloaded for an artifact, or null for a metadata-only module - a Kotlin
 * multiplatform umbrella such as androidx.annotation:annotation, whose code ships in a sibling
 * artifact (annotation-jvm) that the report lists separately.
 *
 * @param {{ groupId: string, artifactId: string, version: string }} artifact
 * @returns {string | null}
 */
function gradleArchive({ groupId, artifactId, version }) {
  const dir = join(GRADLE_CACHE, groupId, artifactId, version);
  const names = [`${artifactId}-${version}.aar`, `${artifactId}-${version}.jar`];
  if (!existsSync(dir)) {
    throw new Error(
      `${groupId}:${artifactId}:${version} is not in the Gradle cache (${GRADLE_CACHE})`,
    );
  }
  for (const hash of readdirSync(dir)) {
    for (const name of names) {
      if (existsSync(join(dir, hash, name))) {
        return join(dir, hash, name);
      }
    }
  }
  return null;
}

/** @returns {Entry[]} */
function androidLibraries() {
  /** @type {any[]} */
  const artifacts = JSON.parse(readFileSync(LICENSEE_REPORT, 'utf8'));
  const apache = [];
  /** @type {Entry[]} */
  const entries = [];

  for (const artifact of artifacts) {
    const id = `${artifact.groupId}:${artifact.artifactId}`;
    const override = POLICY.overrides[id] ?? {};
    const spdx = (artifact.spdxLicenses ?? []).map((/** @type {any} */ l) => l.identifier);
    const license = override.license ?? spdx.join(' OR ');
    if (!license) {
      throw new Error(`${id} names no SPDX licence; add an override to licenses/policy.json`);
    }

    const archive = gradleArchive(artifact);
    const { licenses, notices } = archive ? legalFiles(archive) : { licenses: [], notices: [] };
    if (override.notice) {
      notices.push(policyText(override.notice));
    }

    if (license === 'Apache-2.0' && !override.text) {
      apache.push(artifact.name ? `${id} (${artifact.name})` : id);
      for (const notice of notices) {
        entries.push({ name: `${id} NOTICE`, license, text: notice });
      }
      continue;
    }

    const text = override.text ? policyText(override.text) : licenses[0];
    if (!text) {
      throw new Error(`${id} ships no licence file; add a text override to licenses/policy.json`);
    }
    entries.push({ name: id, license, text, notice: notices.join('\n\n') || undefined });
  }

  if (apache.length > 0) {
    entries.push({
      name: 'Android libraries under the Apache License 2.0',
      license: 'Apache-2.0',
      text: `${apache.sort().join('\n')}\n\n${policyText('texts/Apache-2.0.txt')}`,
    });
  }
  return entries;
}

/**
 * @param {string} path
 * @returns {Promise<any>}
 */
async function github(path) {
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const response = await fetch(`https://api.github.com/${path}`, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API ${path}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/** @returns {Promise<Entry[]>} */
async function swiftPackages() {
  const { pins } = JSON.parse(readFileSync(PACKAGE_RESOLVED, 'utf8'));
  /** @type {Entry[]} */
  const entries = [];

  for (const pin of pins) {
    const match = /^https:\/\/github\.com\/([^/]+)\/([^/]+?)(\.git)?$/.exec(pin.location);
    if (!match) {
      throw new Error(`${pin.identity} is not hosted on GitHub; add its licence by hand`);
    }
    const [, owner, repo] = match;
    const ref = pin.state.revision;
    const override = POLICY.overrides[pin.identity] ?? {};

    const found = await github(`repos/${owner}/${repo}/license?ref=${ref}`);
    const license =
      override.license ?? (found.license.spdx_id === 'NOASSERTION' ? '' : found.license.spdx_id);
    if (!license) {
      throw new Error(`GitHub cannot classify ${pin.identity}'s licence; add an override`);
    }
    const text = override.text
      ? policyText(override.text)
      : Buffer.from(found.content, 'base64').toString('utf8');

    /** @type {{ name: string, download_url: string }[]} */
    const files = await github(`repos/${owner}/${repo}/contents?ref=${ref}`);
    const notices = [];
    for (const file of files.filter((f) => NOTICE_FILE.test(f.name))) {
      notices.push(await (await fetch(file.download_url)).text());
    }
    if (override.notice) {
      notices.push(policyText(override.notice));
    }

    entries.push({
      name: `${repo} (iOS)`,
      license,
      text,
      notice: notices.join('\n\n') || undefined,
    });
  }
  return entries;
}

/** @returns {Promise<string>} */
async function render() {
  const groups = [
    copiedAssets(),
    manualComponents(),
    [npmPackage(join(ROOT, 'node_modules/@capacitor/android'))],
    await swiftPackages(),
    androidLibraries(),
  ];
  return groups
    .map((entries) =>
      entries
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(block)
        .join(''),
    )
    .join('');
}

function runLicensee() {
  execFileSync('./gradlew', ['--quiet', LICENSEE_TASK], { cwd: ANDROID, stdio: 'inherit' });
}

async function main() {
  const check = process.argv.includes('--check');
  runLicensee();
  const content = await render();

  if (!check) {
    writeFileSync(OUTPUT, content);
    console.log(`Wrote ${relative(ROOT, OUTPUT)}.`);
    return;
  }
  const committed = existsSync(OUTPUT) ? readFileSync(OUTPUT, 'utf8') : '';
  if (committed !== content) {
    console.error(
      `${relative(ROOT, OUTPUT)} does not match the dependencies. Run ` +
        '`node scripts/build-third-party-licenses.mjs` and commit the result.',
    );
    process.exit(1);
  }
  console.log(`${relative(ROOT, OUTPUT)} is up to date.`);
}

await main();
