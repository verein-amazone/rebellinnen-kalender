export const CONTENT_ITEM_KINDS = ['wissensimpulse', 'rebellin'] as const;
export type ContentItemKind = (typeof CONTENT_ITEM_KINDS)[number];

/** One "More on this topic" link - a title, an optional second line, and the URL it opens. */
export interface RelatedSourceRecord {
  readonly title: string;
  readonly subtitle: string | null;
  readonly url: string;
}

export const VIDEO_ORIENTATIONS = ['landscape', 'portrait'] as const;
export type VideoOrientation = (typeof VIDEO_ORIENTATIONS)[number];

/**
 * An item's embedded video. YouTube is the only provider: it is the one the privacy policy names,
 * and the app embeds it from its cookie-less domain only after a tap. `id` is the 11-character video
 * id, `orientation` says whether the video is wide or, like a YouTube Short, upright.
 */
export interface VideoRecord {
  readonly provider: 'youtube';
  readonly id: string;
  readonly orientation: VideoOrientation;
}

/**
 * One curated content item - a "Wissen & Impulse" piece or a "Rebell*in" portrait - as it is stored.
 *
 * `validFrom`/`validTo` are either ISO dates (`YYYY-MM-DD`), for a window in one particular year, or
 * month-days (`--MM-DD`), for a window that recurs every year and may wrap the turn of the year. Both
 * `null` marks the item evergreen; a one-off window with only one bound set is open-ended on the other
 * side (see `isWithinWindow`). `eligibleForDaily` mirrors the
 * editorial decision, carried from the source material, on whether the item may ever be picked as the
 * Today page's featured item.
 */
export interface ContentItemRecord {
  readonly id: string;
  readonly kind: ContentItemKind;
  readonly title: string;
  readonly teaser: string;
  readonly bodyMarkdown: string;
  /**
   * The id of the item's picture in the image catalog (`public/content/images.json`), which holds
   * its file, description and attribution. `null` for an item without a picture.
   */
  readonly heroImageId: string | null;
  readonly sourceLabel: string | null;
  readonly sourceUrl: string | null;
  readonly relatedSources: readonly RelatedSourceRecord[];
  readonly validFrom: string | null;
  readonly validTo: string | null;
  readonly eligibleForDaily: boolean;
  readonly video: VideoRecord | null;
  /**
   * The Anlaufstellen the item points to, chosen by hand per item: `null` for none, an empty list
   * for the Anlaufstellen page as a whole, otherwise the ids of the entries to show.
   */
  readonly supportServiceIds: readonly string[] | null;
}
