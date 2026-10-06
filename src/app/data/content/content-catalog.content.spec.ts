import { existsSync, readFileSync } from 'node:fs';
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

interface ImageAttribution {
  readonly path: string;
}

const catalog = JSON.parse(
  readFileSync(join(PUBLIC_DIR, 'content/catalog.json'), 'utf8'),
) as Catalog;
const attributions = JSON.parse(
  readFileSync(join(PUBLIC_DIR, 'image-attributions.json'), 'utf8'),
) as ImageAttribution[];

/** Mirrors `imagePathFor()` in `content-catalog-sync.ts`. */
function imagePathFor(entry: Catalog['items'][number]): string {
  const dir = entry.kind === 'rebellin' ? 'rebellinnen' : 'wissensimpulse';
  return `/content/${dir}/${entry.id}.webp`;
}

describe('public/content/catalog.json', () => {
  it('has a numeric version and at least one item', () => {
    expect(typeof catalog.version).toBe('number');
    expect(catalog.items.length).toBeGreaterThan(0);
  });

  it('gives every entry a unique id', () => {
    const ids = catalog.items.map((item) => item.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ships a bundled image for every entry', () => {
    const missing = catalog.items
      .map(imagePathFor)
      .filter((path) => !existsSync(join(PUBLIC_DIR, path)));

    expect(missing).toEqual([]);
  });

  it('records the licence of every entry image in image-attributions.json', () => {
    const attributed = new Set(attributions.map((attribution) => attribution.path));
    const unattributed = catalog.items.map(imagePathFor).filter((path) => !attributed.has(path));

    expect(unattributed).toEqual([]);
  });

  it('keeps the text fields free of leading and trailing whitespace', () => {
    for (const item of catalog.items) {
      for (const field of ['title', 'teaser', 'bodyMarkdown', 'imageAlt'] as const) {
        const value = item[field];
        expect(value.trim(), `${item.id} ${field}`).toBe(value);
      }
    }
  });
});
