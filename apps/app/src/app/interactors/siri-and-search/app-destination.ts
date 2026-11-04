/** Where a Spotlight result or an App Shortcut opens the app, as router arguments. */
export interface AppDestination {
  readonly commands: readonly string[];
  readonly queryParams?: Readonly<Record<string, string>>;
}

/** The `id` prefix of an Anlaufstelle's entry in iOS search. */
export const SERVICE_DESTINATION_PREFIX = 'service:';

/** The `id` prefix of a bookmarked content item's entry in iOS search. */
export const CONTENT_DESTINATION_PREFIX = 'content:';

/** The screens the App Shortcuts open, by the destination that names each. */
export type ShortcutDestination = 'today' | 'collection' | 'services' | 'new-event';

const FIXED_DESTINATIONS: Readonly<Record<ShortcutDestination, AppDestination>> = {
  today: { commands: ['/today'] },
  collection: { commands: ['/content'], queryParams: { area: 'collection' } },
  services: { commands: ['/content'], queryParams: { area: 'services' } },
  'new-event': { commands: ['/calendar', 'event', 'new'] },
};

/**
 * Turns the string iOS hands over (see `ios/App/App/AppDestinations.swift`) into where to navigate,
 * or `null` for anything this version of the app does not know - an entry indexed by a later
 * version, say - which then leaves the app where it is.
 *
 * Only ids are carried, never a route: whether the content item or the Anlaufstelle still exists is
 * up to the screen it opens, which already handles a missing one.
 */
export function parseAppDestination(raw: string): AppDestination | null {
  if (Object.hasOwn(FIXED_DESTINATIONS, raw)) {
    return FIXED_DESTINATIONS[raw as ShortcutDestination];
  }

  const serviceId = idAfter(raw, SERVICE_DESTINATION_PREFIX);
  if (serviceId !== null) {
    return { commands: ['/content'], queryParams: { area: 'services', service: serviceId } };
  }

  const contentId = idAfter(raw, CONTENT_DESTINATION_PREFIX);
  if (contentId !== null) {
    return { commands: ['/content', contentId] };
  }

  return null;
}

/**
 * Which App Shortcut screen the app `url` shows, if any - the way back from `parseAppDestination`
 * for the four of them. `/content` is Meine Sammlung unless it shows the Anlaufstellen, as on the
 * overview page.
 */
export function shortcutDestinationAt(url: string): ShortcutDestination | null {
  const { pathname, searchParams } = new URL(url, 'app://local');
  switch (pathname) {
    case '/today':
      return 'today';
    case '/calendar/event/new':
      return 'new-event';
    case '/content':
      return searchParams.get('area') === 'services' ? 'services' : 'collection';
    default:
      return null;
  }
}

/** The id after `prefix`, if it is a plausible catalog id: no path, query or fragment in it. */
function idAfter(raw: string, prefix: string): string | null {
  if (!raw.startsWith(prefix)) {
    return null;
  }
  const id = raw.slice(prefix.length);
  return /^[\w-]+$/.test(id) ? id : null;
}
