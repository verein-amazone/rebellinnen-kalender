/** How a support-service action is reached. */
export type SupportServiceActionType = 'phone' | 'sms' | 'website' | 'chat';

/** One contact action, exactly as authored in the catalog - see `SupportServiceCatalogAction`. */
export interface SupportServiceActionRecord {
  readonly type: SupportServiceActionType;
  readonly label: string;
  readonly uri: string;
  readonly displayValue: string | null;
}

/** One `support_services` row: a catalog entry plus its place in the catalog's order. */
export interface SupportServiceRecord {
  readonly id: string;
  readonly region: string;
  readonly name: string;
  readonly teaser: string;
  readonly icon: string;
  readonly actions: readonly SupportServiceActionRecord[];
  readonly position: number;
}
