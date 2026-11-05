import { inject, Injectable } from '@angular/core';

import { assetUrl } from '@app/cross-cutting/helpers/asset-url';
import { MarkdownRenderer } from '@app/cross-cutting/markdown/markdown-renderer';

import { BookmarkDao } from '../daos/bookmark.dao';
import { ContentItemDao } from '../daos/content-item.dao';
import { ContentSearchDao, type ContentSearchEntry } from '../daos/content-search.dao';
import type {
  ContentItemKind,
  ContentItemRecord,
  VideoRecord,
} from '../entities/content-item.record';
import { SQLITE_DATABASE, type SqliteExecutor } from '../gateways/sqlite-database';
import { foldForSearch } from '../search/search-text';
import { ContentCatalogStore } from '../stores/content-catalog.store';

const CATALOG_URL = '/content/catalog.json';

/**
 * One "More on this topic" link as it ships in the catalog: a title, an optional second line, and
 * the URL it opens.
 */
export interface CatalogRelatedSource {
  readonly title: string;
  readonly subtitle?: string;
  readonly url: string;
}

/**
 * One curated item as it ships in the catalog asset. Its picture is only named, by `heroImageId`:
 * the file, what it shows and whom it credits are in the image catalog
 * (`public/content/images.json`), with the rest of what is recorded about each image.
 */
export interface CatalogEntry {
  readonly id: string;
  readonly kind: ContentItemKind;
  readonly title: string;
  readonly teaser: string;
  readonly bodyMarkdown: string;
  /** The id of the item's picture in the image catalog. Optional - an item may ship without one. */
  readonly heroImageId?: string;
  readonly sourceLabel: string | null;
  readonly sourceUrl: string | null;
  /** "More on this topic" links (#22). Optional - omitted on entries that ship without any. */
  readonly relatedSources?: readonly CatalogRelatedSource[];
  /** `YYYY-MM-DD` for one particular year, `--MM-DD` for every year; see `isWithinWindow`. */
  readonly validFrom: string | null;
  readonly validTo: string | null;
  readonly eligibleForDaily: boolean;
  /** The item's embedded video. Optional - omitted on entries without one. */
  readonly video?: VideoRecord;
  /**
   * The Anlaufstellen the item points to. Omitted or `null`: none. `[]`: the Anlaufstellen page as
   * a whole. A list of ids: those entries.
   */
  readonly supportServiceIds?: readonly string[] | null;
}

export interface Catalog {
  readonly version: number;
  readonly items: readonly CatalogEntry[];
}

/**
 * Reconciles the curated content catalog (`public/content/catalog.json`) into `content_items`.
 *
 * Editorial content changes far more often than the app's schema does, so - unlike every other
 * table - `content_items` is not seeded by a migration (see `019-create-schema.ts`).
 * Instead the catalog ships as a versioned JSON asset, bundled with the app like any other static
 * file, and this reconciles the database to match it: only a version bump triggers the
 * diff-and-write work, and once caught up the rest of the session skips even the fetch.
 *
 * Called lazily from the content interactors - never from an app initializer - matching this
 * repo's existing rule that the database connection opens on first use, not at boot.
 */
@Injectable({ providedIn: 'root' })
export class ContentCatalogSync {
  private readonly database = inject(SQLITE_DATABASE);
  private readonly contentItems = inject(ContentItemDao);
  private readonly bookmarks = inject(BookmarkDao);
  private readonly store = inject(ContentCatalogStore);
  private readonly contentSearch = inject(ContentSearchDao);
  private readonly markdown = inject(MarkdownRenderer);

  /**
   * Settled once this session is caught up with the catalog. The asset ships with the app and
   * cannot change while it runs, so every later call - a search runs one per keystroke - reuses it
   * instead of fetching the file again. A failed fetch is not remembered: the next call tries again.
   */
  private caughtUp: Promise<void> | null = null;

  ensureSynced(): Promise<void> {
    this.caughtUp ??= this.sync().then(
      (synced) => {
        if (!synced) {
          this.caughtUp = null;
        }
      },
      (error: unknown) => {
        this.caughtUp = null;
        throw error;
      },
    );
    return this.caughtUp;
  }

  /** `false` when there was no catalog to sync against. */
  private async sync(): Promise<boolean> {
    const catalog = await this.fetchCatalog();
    if (catalog === null) {
      return false;
    }

    if (
      catalog.version === this.store.syncedVersion() &&
      (await this.hasStoredItems(catalog)) &&
      (await this.hasCompleteIndex(catalog))
    ) {
      return true;
    }

    await this.reconcile(catalog.items);
    this.store.setSyncedVersion(catalog.version);
    return true;
  }

  /**
   * The synced version lives in `localStorage` while the items live in SQLite, and the two can
   * disagree - the database can be cleared (a browser dropping IndexedDB on the web, the dev-tools
   * reset, a restore that fails) while the version flag survives, which would otherwise leave the
   * app permanently convinced it is caught up on an empty catalog. One cheap id query per session
   * rules that out.
   */
  private async hasStoredItems(catalog: Catalog): Promise<boolean> {
    if (catalog.items.length === 0) {
      return true;
    }

    return (await this.contentItems.listIds()).length > 0;
  }

  /**
   * The search index arrived with schema version 21, after most devices had already synced the
   * catalog version they ship with - so an unchanged version alone would never fill it. An index
   * that does not hold every item is rebuilt like a version change.
   */
  private async hasCompleteIndex(catalog: Catalog): Promise<boolean> {
    return (await this.contentSearch.count()) === catalog.items.length;
  }

  private async reconcile(entries: readonly CatalogEntry[]): Promise<void> {
    const toPlainText = (markdown: string) => this.markdown.toPlainText(markdown);

    await this.database.transaction(async (tx) => {
      const catalogIds = new Set(entries.map((entry) => entry.id));

      for (const entry of entries) {
        await this.contentItems.upsert(toRecord(entry), tx);
      }

      for (const id of await this.contentItems.listIds(tx)) {
        if (!catalogIds.has(id)) {
          await this.removeItem(id, tx);
        }
      }

      await this.contentSearch.replaceAll(
        entries.map((entry) => toSearchEntry(entry, toPlainText)),
        tx,
      );
    });
  }

  /** A removed catalog item takes its bookmark with it - nothing else in `bookmarks` points at it. */
  private async removeItem(id: string, tx: SqliteExecutor): Promise<void> {
    await this.bookmarks.remove(id, tx);
    await this.contentItems.delete(id, tx);
  }

  /** `null` on any failure - a missing/unreachable/malformed asset must never break the app. */
  private async fetchCatalog(): Promise<Catalog | null> {
    try {
      const response = await fetch(assetUrl(CATALOG_URL));
      if (!response.ok) {
        return null;
      }

      const data: unknown = await response.json();
      return isCatalog(data) ? data : null;
    } catch {
      return null;
    }
  }
}

function isCatalog(value: unknown): value is Catalog {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<Catalog>;
  return typeof candidate.version === 'number' && Array.isArray(candidate.items);
}

function toSearchEntry(
  entry: CatalogEntry,
  toPlainText: (markdown: string) => string,
): ContentSearchEntry {
  return {
    contentItemId: entry.id,
    title: foldForSearch(entry.title),
    teaser: foldForSearch(entry.teaser),
    body: foldForSearch(toPlainText(entry.bodyMarkdown)),
  };
}

function toRecord(entry: CatalogEntry): ContentItemRecord {
  return {
    ...entry,
    heroImageId: entry.heroImageId ?? null,
    relatedSources: (entry.relatedSources ?? []).map((source) => ({
      title: source.title,
      subtitle: source.subtitle ?? null,
      url: source.url,
    })),
    video: entry.video ?? null,
    supportServiceIds: entry.supportServiceIds ?? null,
  };
}
