import { inject, Injectable } from '@angular/core';

import { BookmarkDao } from '../daos/bookmark.dao';
import { ContentItemDao } from '../daos/content-item.dao';
import type {
  ContentItemKind,
  ContentItemRecord,
  DailyRenderMode,
  RelatedSourceRecord,
} from '../entities/content-item.record';
import { SQLITE_DATABASE, type SqliteExecutor } from '../gateways/sqlite-database';
import { ContentCatalogStore } from '../stores/content-catalog.store';

const CATALOG_URL = '/content/catalog.json';

/** One curated item as it ships in the catalog asset - everything except its derived image path. */
export interface CatalogEntry {
  readonly id: string;
  readonly kind: ContentItemKind;
  readonly title: string;
  readonly teaser: string;
  readonly bodyMarkdown: string;
  /** What the bundled image shows, in German. Mandatory - see `public/content/README.md`. */
  readonly imageAlt: string;
  readonly imageAttribution: string | null;
  readonly sourceLabel: string | null;
  readonly sourceUrl: string | null;
  /** "More on this topic" links (#22). Optional - omitted on entries that ship without any. */
  readonly relatedSources?: readonly RelatedSourceRecord[];
  readonly validFrom: string | null;
  readonly validTo: string | null;
  readonly eligibleForDaily: boolean;
  /** How this item renders as today's impulse. Omitted means `teaser`, the ordinary layout. */
  readonly dailyRender?: DailyRenderMode;
}

export interface Catalog {
  readonly version: number;
  readonly items: readonly CatalogEntry[];
}

/**
 * Reconciles the curated content catalog (`public/content/catalog.json`) into `content_items`.
 *
 * Editorial content changes far more often than the app's schema does, so - unlike every other
 * table - `content_items` is not seeded by a migration (see `010-create-content-items.ts`).
 * Instead the catalog ships as a versioned JSON asset, bundled with the app like any other static
 * file, and this reconciles the database to match it: every call is cheap once caught up (a local
 * JSON fetch and a version comparison), and only a version bump triggers the diff-and-write work.
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

  async ensureSynced(): Promise<void> {
    const catalog = await this.fetchCatalog();
    if (catalog === null) {
      return;
    }

    if (catalog.version === this.store.syncedVersion() && (await this.hasStoredItems(catalog))) {
      return;
    }

    await this.reconcile(catalog.items);
    this.store.setSyncedVersion(catalog.version);
  }

  /**
   * The synced version lives in `localStorage` while the items live in SQLite, and the two can
   * disagree - the database can be cleared (a browser dropping IndexedDB on the web, the dev-tools
   * reset, a restore that fails) while the version flag survives, which would otherwise leave the
   * app permanently convinced it is caught up on an empty catalog. One cheap id query per call
   * rules that out.
   */
  private async hasStoredItems(catalog: Catalog): Promise<boolean> {
    if (catalog.items.length === 0) {
      return true;
    }

    return (await this.contentItems.listIds()).length > 0;
  }

  private async reconcile(entries: readonly CatalogEntry[]): Promise<void> {
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
      const response = await fetch(CATALOG_URL);
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

function toRecord(entry: CatalogEntry): ContentItemRecord {
  return {
    ...entry,
    relatedSources: entry.relatedSources ?? [],
    imagePath: imagePathFor(entry),
    dailyRender: entry.dailyRender ?? 'teaser',
  };
}

/** Every catalog entry has a matching bundled image at this path - see `public/content/README`. */
function imagePathFor(entry: CatalogEntry): string {
  const dir = entry.kind === 'rebellin' ? 'rebellinnen' : 'wissensimpulse';
  return `/content/${dir}/${entry.id}.webp`;
}
