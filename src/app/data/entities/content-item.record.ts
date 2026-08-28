export const CONTENT_ITEM_KINDS = ['wissensimpulse', 'rebellin'] as const;
export type ContentItemKind = (typeof CONTENT_ITEM_KINDS)[number];

/**
 * How an item renders when it is the Today page's daily impulse: `image` leads with the picture,
 * `teaser` leads with the teaser line. An editorial call per item - some pictures say more than
 * their teaser does, most do not.
 */
export const DAILY_RENDER_MODES = ['teaser', 'image'] as const;
export type DailyRenderMode = (typeof DAILY_RENDER_MODES)[number];

/** One "More on this topic" link - a title and the URL it points to. */
export interface RelatedSourceRecord {
  readonly title: string;
  readonly url: string;
}

/**
 * One curated content item - a "Wissen & Impulse" piece or a "Rebell*in" portrait - as it is stored.
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
  /** What the picture shows, for people who cannot see it. Never the credit - that is
   *  `imageAttribution`, which is a caption. */
  readonly imageAlt: string | null;
  readonly imageAttribution: string | null;
  readonly sourceLabel: string | null;
  readonly sourceUrl: string | null;
  readonly relatedSources: readonly RelatedSourceRecord[];
  readonly validFrom: string | null;
  readonly validTo: string | null;
  readonly eligibleForDaily: boolean;
  readonly dailyRender: DailyRenderMode;
}
