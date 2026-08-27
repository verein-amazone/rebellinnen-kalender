/** One bookmarked content item, keyed by the item itself - a user either bookmarked it or not. */
export interface BookmarkRecord {
  readonly contentItemId: string;
  readonly createdAt: string;
}
