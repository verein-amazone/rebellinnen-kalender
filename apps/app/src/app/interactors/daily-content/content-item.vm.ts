import type { ContentItemKind } from '@app/data/entities/content-item.record';

/** Re-exported so views can name a content type without importing the data-layer record. */
export type { ContentItemKind };

/**
 * Each content type's display name, in the order the types are listed. The one place the names are
 * spelled: the collection filter, a saved item's badge, the detail screen and the developer catalog
 * all read it, so a rename cannot leave one of them behind.
 */
export const CONTENT_KIND_LABELS: readonly {
  readonly id: ContentItemKind;
  readonly label: string;
}[] = [
  { id: 'wissensimpulse', label: 'Wissen' },
  { id: 'rebellin', label: 'Rebell*innen' },
];

/** The display name of one content type, from `CONTENT_KIND_LABELS`. */
export function contentKindLabel(kind: ContentItemKind): string {
  return CONTENT_KIND_LABELS.find((entry) => entry.id === kind)?.label ?? kind;
}

/** One "More on this topic" link - a title, an optional second line, and the URL it opens. */
export interface RelatedSourceView {
  readonly title: string;
  readonly subtitle: string | null;
  readonly url: string;
}

/**
 * A curated content item as a view needs it - everything `ContentItemRecord` carries, kept as its
 * own type so `view/**` never imports the data-layer record directly (enforced by the `view/**` →
 * `data/**` ESLint boundary).
 */
export interface ContentItemView {
  readonly id: string;
  readonly kind: ContentItemKind;
  readonly title: string;
  readonly teaser: string;
  readonly bodyMarkdown: string;
  readonly imagePath: string | null;
  readonly imageAlt: string | null;
  readonly imageAttribution: string | null;
  readonly sourceLabel: string | null;
  readonly sourceUrl: string | null;
  readonly relatedSources: readonly RelatedSourceView[];
}
