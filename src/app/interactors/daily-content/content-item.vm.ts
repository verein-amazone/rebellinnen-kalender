import type { ContentItemKind } from '@app/data/entities/content-item.record';

/**
 * A curated content item as a view needs it — everything `ContentItemRecord` carries, kept as its
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
  readonly imageAttribution: string | null;
  readonly sourceLabel: string | null;
  readonly sourceUrl: string | null;
}
