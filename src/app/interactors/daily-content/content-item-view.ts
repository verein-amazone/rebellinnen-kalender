import { assetUrl } from '@app/cross-cutting/helpers/asset-url';
import type { ContentItemRecord } from '@app/data/entities/content-item.record';
import type {
  ImageCatalogEntry,
  ImageCatalogGateway,
} from '@app/data/gateways/image-catalog.gateway';

import type { ContentItemView } from './content-item.vm';

/**
 * A stored content item as a view needs it, with its picture looked up in the image catalog by
 * `heroImageId`. An id the catalog does not know leaves the item without a picture, which
 * `content-catalog.content.spec.ts` rules out for everything that ships.
 */
export async function toContentItemView(
  record: ContentItemRecord,
  images: ImageCatalogGateway,
): Promise<ContentItemView> {
  const image = record.heroImageId === null ? null : await images.find(record.heroImageId);
  return {
    id: record.id,
    kind: record.kind,
    title: record.title,
    teaser: record.teaser,
    bodyMarkdown: record.bodyMarkdown,
    // The catalog's path is root-relative; the deployment's base href is only known at runtime.
    imagePath: image === null ? null : assetUrl(image.path),
    imageAlt: image?.alt ?? null,
    imageAttribution: image === null ? null : shortCredit(image),
    sourceLabel: record.sourceLabel,
    sourceUrl: record.sourceUrl,
    relatedSources: record.relatedSources,
  };
}

/**
 * The credit line under a picture: who made it and under which licence. The rest of the
 * attribution - source, changes - is on the Bildnachweise screen. An unknown creator is left out
 * rather than written as "unbekannt" under every such picture.
 */
function shortCredit(image: ImageCatalogEntry): string {
  return image.creator === undefined ? image.license : `${image.creator}, ${image.license}`;
}
