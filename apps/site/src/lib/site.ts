/**
 * What every page needs to know about the app and where it can be found. The landing copy itself
 * lives in the pages; it follows the store listing Verein Amazone approved
 * (apps/app/fastlane/metadata/de-DE/), so a change to one is a reason to look at the other.
 */
export const APP_NAME = 'Rebell*innen';
export const SUBTITLE = 'Dein feministischer Kalender';
export const PROMOTIONAL =
  'Dein feministischer Kalender mit Terminen, To-do-Liste & vielen Infos – ohne Konto, ohne Tracking, alles bleibt auf deinem Gerät.';

export const STORES = __STORES__;

/**
 * The launch day, shown as „Ab … verfügbar“ under the store buttons. Set it to `null` in
 * site.config.json once the app is out and the date is no longer news.
 */
export const RELEASE_DATE = __RELEASE_DATE__;

export const SOURCE_CODE_URL = 'https://github.com/verein-amazone/rebellinnen-kalender';

/**
 * What a screen reader hears after a link that opens in a new tab - Verein Amazone asked for every
 * link that leaves the page to do so. Visually hidden, so the visible label stays the start of the
 * link's name.
 */
export const NEW_TAB_HINT = ' (öffnet in neuem Tab)';

/** The legal texts, in the order the footer lists them. */
export const LEGAL_PAGES = [
  { title: 'Datenschutz', path: '/datenschutz/' },
  { title: 'Nutzungsbedingungen', path: '/nutzungsbedingungen/' },
  { title: 'Impressum', path: '/impressum/' },
] as const;

/** Every page with an address of its own, for the sitemap. The 404 page has none. */
export const PAGE_PATHS = ['/', '/download/', ...LEGAL_PAGES.map(({ path }) => path)];
