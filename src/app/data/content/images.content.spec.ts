import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

import { imagePathFor, type ImageCatalogEntry } from '@app/data/gateways/image-catalog.gateway';

import type { Catalog } from './content-catalog-sync';

/**
 * Guards the authored image catalog (#11), not the code that reads it.
 *
 * `public/content/images.json` is what the Bildnachweise screen shows, and where the content
 * screens take an image's file, description and credit line from. So every licence has to be
 * written the one way that screen and the licence link agree on, and no image may go without a
 * description. Whether a right has actually been cleared is a human review (`needsReview`);
 * `scripts/check-image-rights.mjs` keeps an unreviewed entry out of `main`. The authoring rules
 * live in `docs/content-authoring.md`.
 */
const PUBLIC_DIR = join(process.cwd(), 'public');

/**
 * The licence names the data may use, with the canonical licence URL each one links to. Creative
 * Commons licences use the notation Creative Commons asks attributions to use.
 */
const LICENSES: Readonly<Record<string, string | null>> = {
  'CC BY 2.0': 'https://creativecommons.org/licenses/by/2.0/',
  'CC BY 3.0': 'https://creativecommons.org/licenses/by/3.0/',
  'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/',
  'CC BY-SA 2.0': 'https://creativecommons.org/licenses/by-sa/2.0/',
  'CC BY-SA 2.0 FR': 'https://creativecommons.org/licenses/by-sa/2.0/fr/',
  'CC BY-SA 3.0': 'https://creativecommons.org/licenses/by-sa/3.0/',
  'CC BY-SA 3.0 DE': 'https://creativecommons.org/licenses/by-sa/3.0/de/',
  'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
  'CC BY-NC-ND 4.0': 'https://creativecommons.org/licenses/by-nc-nd/4.0/',
  'CC0 1.0': 'https://creativecommons.org/publicdomain/zero/1.0/',
  'Public Domain': null,
  // No licence: the image is used as is with the rightsholder credited, by a decision of Verein
  // Amazone recorded in docs/content-authoring.md.
  'Alle Rechte vorbehalten': null,
  // Not a licence: the marker for a right that could not be established. Such an image must not
  // ship, which scripts/check-image-rights.mjs enforces for `main`.
  unclear: null,
};

/** The app's own icons, made for this project rather than taken from a third party. */
const OWN_ARTWORK = ['app-icons', 'icons'];

const IMAGE = /\.(webp|png|jpe?g|gif|svg|avif)$/i;

/** An entry as the file holds it; the gateway derives `path` from the id. */
type StoredEntry = Omit<ImageCatalogEntry, 'path'>;

/** Lower-case words joined by single hyphens, so an id is also a safe file name. */
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const images = JSON.parse(
  readFileSync(join(PUBLIC_DIR, 'content/images.json'), 'utf8'),
) as StoredEntry[];
const catalog = JSON.parse(
  readFileSync(join(PUBLIC_DIR, 'content/catalog.json'), 'utf8'),
) as Catalog;

function shippedImages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return OWN_ARTWORK.includes(relative(PUBLIC_DIR, path)) ? [] : shippedImages(path);
    }
    return IMAGE.test(entry.name) ? [`/${relative(PUBLIC_DIR, path).split(sep).join('/')}`] : [];
  });
}

describe('public/content/images.json', () => {
  it('gives every image a unique id that is a slug', () => {
    const ids = images.map((image) => image.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(SLUG);
    }
  });

  it('has exactly one entry for every image that ships, at the path its id gives', () => {
    const paths = images.map((image) => imagePathFor(image.id));

    expect([...paths].sort()).toEqual(shippedImages(PUBLIC_DIR).sort());
  });

  it('only holds images that a content item shows', () => {
    // The onboarding shows one picture from the catalog too, outside any content item.
    const shown = new Set([
      ...catalog.items.map((item) => item.heroImageId),
      'alle-unsere-lieblingssongs-in-einer-playlist',
    ]);

    expect(images.map((image) => image.id).filter((id) => !shown.has(id))).toEqual([]);
  });

  it('names a known licence and links its canonical text', () => {
    for (const { id, license, licenseUrl } of images) {
      expect(Object.keys(LICENSES), id).toContain(license);
      expect(licenseUrl, id).toBe(LICENSES[license]);
    }
  });

  it('gives every entry a title, a source and its changes, and a creator where one is known', () => {
    for (const image of images) {
      const { id } = image;
      expect(image.title.trim(), id).not.toBe('');
      // An unknown creator is left out, never written as a placeholder the screens would show.
      if (image.creator !== undefined) {
        expect(image.creator.trim(), id).not.toBe('');
        expect(['Unknown', 'Unknown author', 'unbekannt'], id).not.toContain(image.creator);
      }
      expect(image.sourceUrl ?? image.source, id).toBeTruthy();
      expect(Array.isArray(image.changes), id).toBe(true);
    }
  });

  it('describes every image, without stray whitespace', () => {
    for (const { id, alt } of images) {
      expect(typeof alt, id).toBe('string');
      expect(alt.trim(), id).not.toBe('');
      expect(alt.trim(), id).toBe(alt);
    }
  });

  it('leaves the path and the credit line out, since both follow from the other fields', () => {
    for (const image of images) {
      expect(Object.keys(image), image.id).not.toContain('path');
      expect(Object.keys(image), image.id).not.toContain('credit');
    }
  });

  it('records why a public-domain image is in the public domain', () => {
    for (const { id, license, publicDomainBasis } of images) {
      if (license === 'Public Domain') {
        expect(publicDomainBasis?.trim(), id).toBeTruthy();
      }
    }
  });
});
