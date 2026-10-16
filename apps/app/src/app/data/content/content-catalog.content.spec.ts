import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { Catalog } from './content-catalog-sync';

/**
 * Guards the authored content catalog itself, not the code that reads it.
 *
 * `catalog.json` is hand-edited and excluded from Prettier, and `ContentCatalogSync` swallows a
 * parse failure by design (a broken asset must never break the app) - so a truncated file once
 * passed CI and would have silently stopped every catalog update from syncing. This spec is what
 * makes such a file fail the build. The authoring rules live in `docs/content-authoring.md`.
 */
const PUBLIC_DIR = join(process.cwd(), 'public');

interface ImageCatalogEntry {
  readonly id: string;
}

const catalog = JSON.parse(
  readFileSync(join(PUBLIC_DIR, 'content/catalog.json'), 'utf8'),
) as Catalog;
const images = JSON.parse(
  readFileSync(join(PUBLIC_DIR, 'content/images.json'), 'utf8'),
) as ImageCatalogEntry[];

describe('public/content/catalog.json', () => {
  it('has a numeric version and at least one item', () => {
    expect(typeof catalog.version).toBe('number');
    expect(catalog.items.length).toBeGreaterThan(0);
  });

  it('gives every entry a unique id', () => {
    const ids = catalog.items.map((item) => item.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every entry a picture from the image catalog', () => {
    // The daily impulse leads with the picture, so every item ships one. The file itself is checked
    // by images.content.spec.ts.
    const known = new Set(images.map((image) => image.id));

    for (const item of catalog.items) {
      expect(item.heroImageId, item.id).toBeDefined();
      expect(known.has(item.heroImageId ?? ''), `${item.id} ${item.heroImageId}`).toBe(true);
    }
  });

  it('gives every related source a title, an https link and, if any, a non-empty subtitle', () => {
    for (const item of catalog.items) {
      for (const source of item.relatedSources ?? []) {
        expect(source.title.trim(), item.id).not.toBe('');
        expect(new URL(source.url).protocol, `${item.id} ${source.url}`).toBe('https:');
        if (source.subtitle !== undefined) {
          expect(source.subtitle.trim(), `${item.id} ${source.title}`).not.toBe('');
        }
      }
    }
  });

  it('keeps the text fields free of leading and trailing whitespace', () => {
    for (const item of catalog.items) {
      for (const field of ['title', 'teaser', 'bodyMarkdown'] as const) {
        const value = item[field];
        expect(value.trim(), `${item.id} ${field}`).toBe(value);
      }
    }
  });

  it('leaves everything about a picture to the image catalog, and names it only by id', () => {
    // Recorded once, with the rest of what is known about the image, so the two cannot disagree.
    for (const item of catalog.items) {
      for (const key of ['imagePath', 'imageAlt', 'imageAttribution']) {
        expect(Object.keys(item), item.id).not.toContain(key);
      }
    }
  });
});
