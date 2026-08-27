/**
 * One credited image as a view needs it - kept as its own type so `view/**` never imports the
 * data-layer gateway type directly (enforced by the `view/**` → `data/**` ESLint boundary).
 */
export interface ImageCreditView {
  readonly path: string;
  readonly title: string;
  readonly creator: string;
  readonly sourceUrl?: string;
  readonly source?: string;
  readonly license: string;
  readonly licenseUrl: string | null;
  readonly changes: readonly string[];
}
