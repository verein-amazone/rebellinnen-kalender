import { Injectable } from '@angular/core';

const CATALOG_URL = '/support-services/catalog.json';

const ACTION_TYPES = ['phone', 'sms', 'website', 'chat'] as const;

/** How to reach a support service one specific way. */
export type SupportServiceActionType = (typeof ACTION_TYPES)[number];

/**
 * One contact action for a support service — a `tel:`/`sms:`/`https:` URI plus the label and
 * (for `phone`/`sms`) the human-readable number to show alongside it. `uri` is the exact value
 * to hand to the OS/browser: phone-number formatting (short numbers vs. `+43…` E.164 numbers vs.
 * `0800` numbers) is a content-authoring decision baked into the catalog data, not something the
 * app infers at runtime — see `docs/content-authoring.md`.
 */
export interface SupportServiceCatalogAction {
  readonly type: SupportServiceActionType;
  readonly label: string;
  readonly uri: string;
  readonly displayValue?: string;
}

/** One curated support-service entry — see `public/support-services/catalog.json`. */
export interface SupportServiceCatalogItem {
  readonly id: string;
  readonly region: string;
  readonly name: string;
  readonly teaser: string;
  readonly crisis?: boolean;
  /** One emoji shown in the card's badge until a rights-cleared logo replaces it (`logoPath`). */
  readonly icon: string;
  /** Hex colour tinting the badge behind `icon`. */
  readonly color: string;
  /** A real organisation logo, once its usage rights are cleared — see `docs/content-authoring.md`. */
  readonly logoPath?: string;
  readonly actions: readonly SupportServiceCatalogAction[];
}

/**
 * Reads the static support-services catalog shown under Content → Anlaufstellen (#24).
 *
 * Ships as a plain bundled asset, like `LegalContentGateway`'s licence files: the catalog has no
 * per-item state to persist (no bookmarking, no read history), so — unlike the daily-impulse
 * catalog — there is no SQLite sync layer, just a fetch.
 */
@Injectable({ providedIn: 'root' })
export class SupportServiceCatalogGateway {
  /** Empty on any failure — a missing/unreachable/malformed file must never break the page. */
  async fetchCatalog(): Promise<readonly SupportServiceCatalogItem[]> {
    try {
      const response = await fetch(CATALOG_URL);
      if (!response.ok) {
        return [];
      }

      const data: unknown = await response.json();
      return isCatalogPayload(data) ? data.items.filter(isCatalogItem) : [];
    } catch {
      return [];
    }
  }
}

function isCatalogPayload(value: unknown): value is { items: unknown[] } {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as { items?: unknown };
  return Array.isArray(candidate.items);
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
    (candidate.crisis === undefined || typeof candidate.crisis === 'boolean') &&
    typeof candidate.icon === 'string' &&
    typeof candidate.color === 'string' &&
    (candidate.logoPath === undefined || typeof candidate.logoPath === 'string') &&
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
