/**
 * The regions the Anlaufstellen catalog files its entries under, by the id the catalog uses, with
 * their display name, in the recommended display order (design handover #24): "Online & Telefon"
 * first, then Vorarlberg, Tirol, Salzburg, then the remaining federal states.
 *
 * Part of the catalog's vocabulary, which is why it lives with the data: the search index carries
 * the region's name, so „Tirol“ finds every entry filed under `tirol`.
 */
export const SUPPORT_SERVICE_REGIONS: readonly { readonly id: string; readonly label: string }[] = [
  { id: 'online', label: 'Online & Telefon' },
  { id: 'vorarlberg', label: 'Vorarlberg' },
  { id: 'tirol', label: 'Tirol' },
  { id: 'salzburg', label: 'Salzburg' },
  { id: 'kaernten', label: 'Kärnten' },
  { id: 'steiermark', label: 'Steiermark' },
  { id: 'oberoesterreich', label: 'Oberösterreich' },
  { id: 'niederoesterreich', label: 'Niederösterreich' },
  { id: 'wien', label: 'Wien' },
  { id: 'burgenland', label: 'Burgenland' },
];

/** A region's display name; an id the list does not know stays as it is. */
export function supportServiceRegionLabel(id: string): string {
  return SUPPORT_SERVICE_REGIONS.find((region) => region.id === id)?.label ?? id;
}
