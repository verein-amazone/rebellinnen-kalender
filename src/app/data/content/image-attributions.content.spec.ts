import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { ImageAttribution } from '@app/data/gateways/legal-content.gateway';

/**
 * Guards the authored image attribution data (#11), not the code that reads it.
 *
 * `public/image-attributions.json` is what the Bildnachweise screen shows, so every licence has to
 * be written the one way that screen and the licence link agree on. Whether a right has actually
 * been cleared is a human review (`needsReview`); `scripts/check-image-rights.mjs` keeps an
 * unreviewed entry out of `main`. The authoring rules live in `docs/content-authoring.md`.
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
  // Not a licence: the marker for a right that could not be established. Such an image must not
  // ship, which scripts/check-image-rights.mjs enforces for `main`.
  unclear: null,
};

/** The app's own icons, made for this project rather than taken from a third party. */
const OWN_ARTWORK = ['app-icons', 'icons'];

const IMAGE = /\.(webp|png|jpe?g|gif|svg|avif)$/i;

const attributions = JSON.parse(
  readFileSync(join(PUBLIC_DIR, 'image-attributions.json'), 'utf8'),
) as ImageAttribution[];

function shippedImages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return OWN_ARTWORK.includes(relative(PUBLIC_DIR, path)) ? [] : shippedImages(path);
    }
    return IMAGE.test(entry.name) ? [`/${relative(PUBLIC_DIR, path).split(sep).join('/')}`] : [];
  });
}

describe('public/image-attributions.json', () => {
  it('has exactly one entry for every image that ships', () => {
    const paths = attributions.map((attribution) => attribution.path);

    expect(new Set(paths).size).toBe(paths.length);
    expect([...paths].sort()).toEqual(shippedImages(PUBLIC_DIR).sort());
  });

  it('names a known licence and links its canonical text', () => {
    for (const { path, license, licenseUrl } of attributions) {
      expect(Object.keys(LICENSES), path).toContain(license);
      expect(licenseUrl, path).toBe(LICENSES[license]);
    }
  });

  it('gives every entry a title, a creator, a source and its changes', () => {
    for (const attribution of attributions) {
      const { path } = attribution;
      expect(attribution.title.trim(), path).not.toBe('');
      expect(attribution.creator.trim(), path).not.toBe('');
      expect(attribution.sourceUrl ?? attribution.source, path).toBeTruthy();
      expect(Array.isArray(attribution.changes), path).toBe(true);
    }
  });

  it('records why a public-domain image is in the public domain', () => {
    for (const { path, license, publicDomainBasis } of attributions) {
      if (license === 'Public Domain') {
        expect(publicDomainBasis?.trim(), path).toBeTruthy();
      }
    }
  });
});
