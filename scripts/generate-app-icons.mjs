#!/usr/bin/env node
/**
 * Generates every native app-icon asset from the square sources in `resources/app-icons/`.
 *
 * The app ships three interchangeable launcher icons (#9). `@capacitor/assets` is not used here
 * because it generates exactly one icon set per project, while this app needs one set per icon plus
 * the iOS alternate asset catalogs and the Android `activity-alias` mipmaps that go with them.
 *
 * The output is committed, so this script only has to run when an icon source changes:
 *
 *     node scripts/generate-app-icons.mjs
 *
 * What it writes per icon:
 *
 * - `ios/App/App/Assets.xcassets/<catalog>.appiconset/` - one flat 1024px PNG, full-bleed. iOS
 *   applies its own corner mask, so the artwork stays edge to edge.
 * - `android/.../mipmap-<density>/<name>.png` - the legacy (pre-API-26) square launcher icon,
 *   also full-bleed.
 * - `android/.../mipmap-<density>/<name>_round.png` - the legacy round icon: the artwork inside the
 *   adaptive safe zone on a solid disc, so nothing is clipped.
 * - `android/.../mipmap-<density>/<name>_foreground.png` - the adaptive foreground: transparent
 *   canvas with the artwork scaled into the 72dp-of-108dp safe zone. Everything outside that zone
 *   can be cropped by the launcher mask, which would otherwise cut the spikes off the artwork.
 * - `android/.../mipmap-anydpi-v26/<name>.xml` and `<name>_round.xml` - the adaptive icon, pairing
 *   that foreground with a solid background colour sampled from the source's own corners, so the
 *   padding is invisible.
 * - `public/app-icons/<id>.webp` - the preview shown on the „App-Symbol“ settings screen.
 *
 * Adding a fourth icon means dropping a square PNG into `resources/app-icons/`, adding an entry to
 * `ICONS` below, registering an `activity-alias` in `AndroidManifest.xml`, adding the catalog name
 * to `ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES` in the Xcode project, and adding the option to
 * `AppIconInteractor`.
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * `catalog` is the iOS asset-catalog name and `resource` the Android mipmap base name. The default
 * icon has to keep the names the untouched parts of the native projects already reference:
 * `AppIcon` in the Xcode target and `@mipmap/ic_launcher` in `AndroidManifest.xml`.
 *
 * iOS alternate catalogs must not start with `AppIcon` - the system fails to resolve them on device.
 */
const ICONS = [
  { id: 'klassisch', source: 'klassisch.png', catalog: 'AppIcon', resource: 'ic_launcher' },
  { id: 'pixel', source: 'pixel.png', catalog: 'Pixel', resource: 'ic_launcher_pixel' },
  { id: 'nacht', source: 'nacht.png', catalog: 'Nacht', resource: 'ic_launcher_nacht' },
];

/** Legacy launcher icon size in px per density bucket (48dp). */
const LEGACY_SIZES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };

/** Adaptive icon layer size in px per density bucket (108dp). */
const ADAPTIVE_SIZES = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

/**
 * The adaptive safe zone is the centre 72dp of the 108dp layer; anything outside may be masked
 * away. The artwork is scaled to exactly that fraction so it survives every launcher shape.
 */
const SAFE_ZONE_RATIO = 72 / 108;

const IOS_ICON_SIZE = 1024;
const PREVIEW_SIZE = 192;

const iosAssets = join(root, 'ios/App/App/Assets.xcassets');
const androidRes = join(root, 'android/app/src/main/res');
const previewDir = join(root, 'public/app-icons');

await main();

async function main() {
  await mkdir(previewDir, { recursive: true });

  const backgrounds = [];

  for (const icon of ICONS) {
    const source = join(root, 'resources/app-icons', icon.source);
    const background = await sampleCornerColour(source);
    backgrounds.push({ icon, background });

    await writeIosIcon(icon, source);
    await writeAndroidBitmaps(icon, source, background);
    await writeAdaptiveXml(icon);
    await writePreview(icon, source);

    console.log(`${icon.id}: background ${background}`);
  }

  await writeBackgroundColours(backgrounds);
}

/**
 * The corners of every source are its flat background, and it differs slightly per icon. Using it
 * as the adaptive background colour makes the safe-zone padding invisible.
 *
 * The average of a whole corner block is taken rather than a single pixel: the sources carry a
 * little grain, and a pixel that happens to sit a few levels off the mean leaves a visible seam
 * where the scaled-down artwork meets the background layer.
 */
async function sampleCornerColour(source) {
  const { width, height } = await sharp(source).metadata();
  const block = Math.round(Math.min(width, height) * 0.05);
  const corners = [
    { left: 0, top: 0 },
    { left: width - block, top: 0 },
    { left: 0, top: height - block },
    { left: width - block, top: height - block },
  ];

  // Averaged over the raw sRGB bytes rather than through `sharp.stats()`, whose means are computed
  // in linear light and come back several shades too bright for a dark background like this one.
  const means = [0, 0, 0];
  for (const corner of corners) {
    const { data, info } = await sharp(source)
      .extract({ ...corner, width: block, height: block })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = info.width * info.height;
    for (let pixel = 0; pixel < pixels; pixel += 1) {
      const offset = pixel * info.channels;
      means.forEach((_, index) => (means[index] += data[offset + index] / pixels / corners.length));
    }
  }

  const hex = means.map((mean) => Math.round(mean).toString(16).padStart(2, '0'));
  return `#${hex.join('')}`.toUpperCase();
}

async function writeIosIcon(icon, source) {
  const dir = join(iosAssets, `${icon.catalog}.appiconset`);
  const filename = `${icon.catalog}-1024.png`;

  // Removed rather than overwritten: the stock catalog ships a differently named PNG, and a
  // leftover file in an appiconset is an Xcode build warning.
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });

  // App Store icons must not carry an alpha channel, so the artwork is flattened.
  await sharp(source)
    .resize(IOS_ICON_SIZE, IOS_ICON_SIZE, { fit: 'cover' })
    .flatten()
    .png()
    .toFile(join(dir, filename));

  const contents = {
    images: [{ filename, idiom: 'universal', platform: 'ios', size: '1024x1024' }],
    info: { author: 'xcode', version: 1 },
  };
  await writeFile(join(dir, 'Contents.json'), `${JSON.stringify(contents, null, 2)}\n`);
}

async function writeAndroidBitmaps(icon, source, background) {
  for (const [density, size] of Object.entries(LEGACY_SIZES)) {
    const dir = join(androidRes, `mipmap-${density}`);
    await mkdir(dir, { recursive: true });

    await sharp(source)
      .resize(size, size, { fit: 'cover' })
      .flatten()
      .png()
      .toFile(join(dir, `${icon.resource}.png`));

    await sharp(await safeZoneLayer(source, size, background))
      .composite([{ input: discMask(size), blend: 'dest-in' }])
      .png()
      .toFile(join(dir, `${icon.resource}_round.png`));
  }

  for (const [density, size] of Object.entries(ADAPTIVE_SIZES)) {
    const dir = join(androidRes, `mipmap-${density}`);
    await mkdir(dir, { recursive: true });

    await sharp(await safeZoneLayer(source, size, null))
      .png()
      .toFile(join(dir, `${icon.resource}_foreground.png`));
  }
}

/**
 * The artwork scaled to the adaptive safe zone and centred on a `size`×`size` canvas. A `null`
 * background leaves the padding transparent, which is what the adaptive foreground layer needs.
 */
async function safeZoneLayer(source, size, background) {
  const artwork = Math.round(size * SAFE_ZONE_RATIO);
  const offset = Math.round((size - artwork) / 2);
  const scaled = await sharp(source).resize(artwork, artwork, { fit: 'cover' }).png().toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: scaled, left: offset, top: offset }])
    .png()
    .toBuffer();
}

/** A white disc on transparent, used as a `dest-in` mask to round the legacy round icon. */
function discMask(size) {
  const radius = size / 2;
  return Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${radius}" cy="${radius}" r="${radius}" fill="#fff"/></svg>`,
  );
}

async function writeAdaptiveXml(icon) {
  const dir = join(androidRes, 'mipmap-anydpi-v26');
  await mkdir(dir, { recursive: true });

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/${icon.resource}_background" />
    <foreground android:drawable="@mipmap/${icon.resource}_foreground" />
</adaptive-icon>
`;

  await writeFile(join(dir, `${icon.resource}.xml`), xml);
  await writeFile(join(dir, `${icon.resource}_round.xml`), xml);
}

async function writeBackgroundColours(backgrounds) {
  const colours = backgrounds
    .map(
      ({ icon, background }) =>
        `    <color name="${icon.resource}_background">${background}</color>`,
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<!-- Generated by scripts/generate-app-icons.mjs. Each colour is the flat background of its icon
     source, so the adaptive icon's safe-zone padding is invisible. Do not edit by hand. -->
<resources>
${colours}
</resources>
`;

  await writeFile(join(androidRes, 'values/ic_launcher_background.xml'), xml);
}

async function writePreview(icon, source) {
  await sharp(source)
    .resize(PREVIEW_SIZE, PREVIEW_SIZE, { fit: 'cover' })
    .webp({ quality: 90 })
    .toFile(join(previewDir, `${icon.id}.webp`));
}
