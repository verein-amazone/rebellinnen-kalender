import { Injectable } from '@angular/core';

import { assetUrl } from '@app/cross-cutting/helpers/asset-url';

const CATALOG_URL = '/support-services/catalog.json';

const ACTION_TYPES = ['phone', 'sms', 'website', 'chat'] as const;

/** How to reach a support service one specific way. */
export type SupportServiceActionType = (typeof ACTION_TYPES)[number];

/**
 * One contact action for a support service - a `tel:`/`sms:`/`https:` URI plus the label and
 * (for `phone`/`sms`) the human-readable number to show alongside it. `uri` is the exact value
 * to hand to the OS/browser: phone-number formatting (short numbers vs. `+43…` E.164 numbers vs.
 * `0800` numbers) is a content-authoring decision baked into the catalog data, not something the
 * app infers at runtime - see `docs/content-authoring.md`.
 */
export interface SupportServiceCatalogAction {
  readonly type: SupportServiceActionType;
  readonly label: string;
  readonly uri: string;
  readonly displayValue?: string;
}

/** One curated support-service entry - see `public/support-services/catalog.json`. */
export interface SupportServiceCatalogItem {
  readonly id: string;
  readonly region: string;
  readonly name: string;
  readonly teaser: string;
  /** One emoji, drawn plain as the card's lead visual. */
  readonly icon: string;
  readonly actions: readonly SupportServiceCatalogAction[];
}

/** The whole asset: its version, bumped on every edit, and the entries that passed the checks. */
export interface SupportServiceCatalog {
  readonly version: number;
  readonly items: readonly SupportServiceCatalogItem[];
}

/**
 * Reads the static support-services catalog shown under Content → Anlaufstellen (#24).
 *
 * Ships as a bundled, versioned JSON asset. `SupportServiceCatalogSync` reconciles it into the
 * `support_services` table, so the Anlaufstellen can be searched in SQLite like the content - this
 * gateway is only the read of the file.
 */
@Injectable({ providedIn: 'root' })
export class SupportServiceCatalogGateway {
  /**
   * `null` on any failure - a missing, unreachable or malformed file must never break the page, and
   * the sync then keeps what it reconciled last. An entry that fails its checks is dropped alone.
   */
  async fetchCatalog(): Promise<SupportServiceCatalog | null> {
    try {
      const response = await fetch(assetUrl(CATALOG_URL));
      if (!response.ok) {
        return null;
      }

      const data: unknown = await response.json();
      return isCatalogPayload(data)
        ? { version: data.version, items: data.items.filter(isCatalogItem) }
        : null;
    } catch {
      return null;
    }
  }
}

function isCatalogPayload(value: unknown): value is { version: number; items: unknown[] } {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as { version?: unknown; items?: unknown };
  return typeof candidate.version === 'number' && Array.isArray(candidate.items);
}

function isCatalogItem(value: unknown): value is SupportServiceCatalogItem {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<SupportServiceCatalogItem>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.region === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.teaser === 'string' &&
    typeof candidate.icon === 'string' &&
    Array.isArray(candidate.actions) &&
    candidate.actions.every(isCatalogAction)
  );
}

function isCatalogAction(value: unknown): value is SupportServiceCatalogAction {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<SupportServiceCatalogAction>;
  return (
    typeof candidate.type === 'string' &&
    (ACTION_TYPES as readonly string[]).includes(candidate.type) &&
    typeof candidate.label === 'string' &&
    typeof candidate.uri === 'string' &&
    (candidate.displayValue === undefined || typeof candidate.displayValue === 'string')
  );
}
