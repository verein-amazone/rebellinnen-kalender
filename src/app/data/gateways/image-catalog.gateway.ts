import { Injectable } from '@angular/core';

import { assetUrl } from '@app/cross-cutting/helpers/asset-url';

const IMAGE_CATALOG_URL = '/content/images.json';

/**
 * One image the app ships, with everything that is said about it - see `public/content/images.json`
 * and `docs/content-authoring.md`. `path` is not in the file: it follows from the id.
 */
export interface ImageCatalogEntry {
  readonly id: string;
  /** Root-relative path of the bundled file, `/content/images/<id>.webp`. */
  readonly path: string;
  readonly title: string;
  /** What the picture shows, in German, for people who cannot see it. Never the credit. */
  readonly alt: string;
  /** Who made the picture. Absent when that is unknown. */
  readonly creator?: string;
  readonly sourceUrl?: string;
  readonly source?: string;
  readonly license: string;
  readonly licenseUrl: string | null;
  readonly changes: readonly string[];
  readonly permissionRef?: string;
  readonly publicDomainBasis?: string;
  readonly needsReview?: boolean;
  readonly reviewNote?: string;
}

/** An entry as it is written in the file. */
type StoredImageCatalogEntry = Omit<ImageCatalogEntry, 'path'>;

/** Where the file for the image `id` is bundled. */
export function imagePathFor(id: string): string {
  return `/content/images/${id}.webp`;
}

/**
 * Reads the image catalog: the one place an image's file, description, creator, source and licence
 * are recorded. Content items only name their image's id; the content screens and the
 * Bildnachweise screen look the rest up here, so nothing about an image is written down twice.
 *
 * Ships as a plain file alongside the app, so it loads fully offline. It cannot change while the
 * app runs, so it is read once and kept.
 */
@Injectable({ providedIn: 'root' })
export class ImageCatalogGateway {
  private entries: readonly ImageCatalogEntry[] | null = null;

  /**
   * Every image in the catalog. Empty on any failure - a missing or malformed file must never break
   * a screen. A failed read is not kept, so the next call tries again.
   */
  async list(): Promise<readonly ImageCatalogEntry[]> {
    this.entries ??= await fetchEntries();
    return this.entries ?? [];
  }

  /** The catalog entry for the image `id`, or `null` if there is none. */
  async find(id: string): Promise<ImageCatalogEntry | null> {
    return (await this.list()).find((entry) => entry.id === id) ?? null;
  }
}

async function fetchEntries(): Promise<readonly ImageCatalogEntry[] | null> {
  try {
    const response = await fetch(assetUrl(IMAGE_CATALOG_URL));
    if (!response.ok) {
      return null;
    }

    const data: unknown = await response.json();
    if (!isImageCatalog(data)) {
      return null;
    }

    return data.map((entry) => ({ ...entry, path: imagePathFor(entry.id) }));
  } catch {
    return null;
  }
}

function isImageCatalog(value: unknown): value is readonly StoredImageCatalogEntry[] {
  return Array.isArray(value) && value.every(isImageCatalogEntry);
}

function isImageCatalogEntry(value: unknown): value is StoredImageCatalogEntry {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<StoredImageCatalogEntry>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.alt === 'string' &&
    (candidate.creator === undefined || typeof candidate.creator === 'string') &&
    typeof candidate.license === 'string' &&
    Array.isArray(candidate.changes)
  );
}
