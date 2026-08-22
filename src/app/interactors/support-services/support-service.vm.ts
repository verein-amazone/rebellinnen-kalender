/** How a support-service action is reached — decides the icon and the URI scheme's handling. */
export type SupportServiceActionType = 'phone' | 'sms' | 'website' | 'chat';

/**
 * One way to contact a support service, exactly as authored: `uri` is the literal `tel:`/`sms:`/
 * `https:` value to hand to the OS/browser, and `label` is the exact button text. Neither is
 * derived at render time — a short number like `147` and a normal number like `+43800222555`
 * both arrive pre-formatted from the catalog, so the view never has to guess which is which.
 */
export interface SupportServiceActionView {
  readonly type: SupportServiceActionType;
  readonly label: string;
  readonly uri: string;
  readonly displayValue: string | null;
}

/**
 * A curated support-service entry as a view needs it — kept as its own type so `view/**` never
 * imports the gateway's raw catalog-item shape directly (enforced by the `view/**` → `data/**`
 * ESLint boundary).
 */
export interface SupportServiceView {
  readonly id: string;
  readonly region: string;
  readonly name: string;
  readonly teaser: string;
  readonly crisis: boolean;
  /** One emoji shown in the card's badge until a rights-cleared logo replaces it (`logoPath`). */
  readonly icon: string;
  /** Hex colour tinting the badge behind `icon`. */
  readonly color: string;
  /** A real organisation logo, once its usage rights are cleared; `null` until then. */
  readonly logoPath: string | null;
  readonly actions: readonly SupportServiceActionView[];
}

/** One region the Anlaufstellen filter chips may offer. */
export interface SupportServiceRegion {
  readonly id: string;
  readonly label: string;
}
