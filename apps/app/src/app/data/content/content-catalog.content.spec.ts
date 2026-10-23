import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Temporal } from 'temporal-polyfill';
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

interface SupportServiceCatalogEntry {
  readonly id: string;
}

/** A one-off bound (`2027-03-08`) or a yearly one (`--03-08`); see `isWithinWindow`. */
const ONE_OFF_BOUND = /^\d{4}-\d{2}-\d{2}$/;
const YEARLY_BOUND = /^--\d{2}-\d{2}$/;
/** The shape of a YouTube video id, which is all the embed URL is built from. */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

const catalog = JSON.parse(
  readFileSync(join(PUBLIC_DIR, 'content/catalog.json'), 'utf8'),
) as Catalog;
const images = JSON.parse(
  readFileSync(join(PUBLIC_DIR, 'content/images.json'), 'utf8'),
) as ImageCatalogEntry[];
const supportServices = (
  JSON.parse(readFileSync(join(PUBLIC_DIR, 'support-services/catalog.json'), 'utf8')) as {
    readonly items: readonly SupportServiceCatalogEntry[];
  }
).items;

/** Whether `value` names a real calendar day in the form the pattern gives (`Temporal` refuses 02-30). */
function isRealBound(value: string): boolean {
  try {
    if (YEARLY_BOUND.test(value)) {
      Temporal.PlainMonthDay.from(value);
      return true;
    }
    return ONE_OFF_BOUND.test(value) && Temporal.PlainDate.from(value).toString() === value;
  } catch {
    return false;
  }
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

  it('gives a dated entry a real window: both bounds one-off, or both yearly', () => {
    // A window mixing the two forms, or a yearly one with an open side, would match no day at all.
    for (const item of catalog.items) {
      const bounds = [item.validFrom, item.validTo].filter((bound) => bound !== null);
      for (const bound of bounds) {
        expect(isRealBound(bound), `${item.id} ${bound}`).toBe(true);
      }

      const yearly = bounds.filter((bound) => YEARLY_BOUND.test(bound));
      expect([0, 2], `${item.id} mixes or half-sets a yearly window`).toContain(yearly.length);
      if (yearly.length === 0 && item.validFrom !== null && item.validTo !== null) {
        expect(item.validFrom <= item.validTo, `${item.id} ends before it starts`).toBe(true);
      }
    }
  });

  it('names a video by a well-formed YouTube id and an orientation', () => {
    for (const item of catalog.items.filter((entry) => entry.video !== undefined)) {
      expect(item.video?.provider, item.id).toBe('youtube');
      expect(item.video?.id, item.id).toMatch(YOUTUBE_ID);
      expect(['landscape', 'portrait'], item.id).toContain(item.video?.orientation);
    }
  });

  it('points only to Anlaufstellen that exist, each once', () => {
    // A renamed or removed Anlaufstelle fails here rather than silently dropping the link.
    const known = new Set(supportServices.map((service) => service.id));

    for (const item of catalog.items) {
      const ids = item.supportServiceIds;
      if (ids === undefined || ids === null) {
        continue;
      }

      expect(Array.isArray(ids), item.id).toBe(true);
      expect(new Set(ids).size, `${item.id} repeats an Anlaufstelle`).toBe(ids.length);
      for (const id of ids) {
        expect(known.has(id), `${item.id} ${id}`).toBe(true);
      }
    }
  });
});
