export const CONTENT_ITEM_KINDS = ['wissensimpulse', 'rebellin'] as const;
export type ContentItemKind = (typeof CONTENT_ITEM_KINDS)[number];

/**
 * One curated content item — a "Wissen & Impulse" piece or a "Rebell*in" portrait — as it is stored.
 *
 * `validFrom`/`validTo` are ISO dates (`YYYY-MM-DD`); both `null` marks the item evergreen. An item
 * with only one of the two bounds set is open-ended on the other side. `eligibleForDaily` mirrors the
 * editorial decision, carried from the source material, on whether the item may ever be picked as the
 * Today page's featured item.
 */
export interface ContentItemRecord {
  readonly id: string;
  readonly kind: ContentItemKind;
  readonly title: string;
  readonly teaser: string;
  readonly bodyMarkdown: string;
  readonly imagePath: string | null;
  readonly imageAttribution: string | null;
  readonly sourceLabel: string | null;
  readonly sourceUrl: string | null;
  readonly validFrom: string | null;
  readonly validTo: string | null;
  readonly eligibleForDaily: boolean;
}
