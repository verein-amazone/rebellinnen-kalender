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

export const SOURCE_CODE_URL = 'https://github.com/verein-amazone/rebellinnen-kalender';

/** The legal texts, in the order the footer lists them. */
export const LEGAL_PAGES = [
  { title: 'Datenschutz', path: '/datenschutz/' },
  { title: 'Nutzungsbedingungen', path: '/nutzungsbedingungen/' },
  { title: 'Impressum', path: '/impressum/' },
] as const;

/** Every page with an address of its own, for the sitemap. The 404 page has none. */
export const PAGE_PATHS = ['/', '/download/', ...LEGAL_PAGES.map(({ path }) => path)];
