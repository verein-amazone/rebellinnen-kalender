import type { NavigationBehaviorOptions, UrlSerializer } from '@angular/router';

/** Identifies a navigation made with `RETURN_NAVIGATION`. */
const RETURNING = Symbol('returning');

/**
 * Options for a navigation that goes back to the screen the user came from: the back arrow of a
 * focused screen, or a form that sends the user back to where it was opened once it is saved.
 *
 * It replaces the current history entry, for the reasons `FocusedScreenScaffold` gives, and tells
 * `MainNavigationScaffold` to put the screen back where the user left it instead of at the top.
 * The router's own scroll restoration cannot do that here: it restores on the browser's back
 * button only, which these navigations are not, and it scrolls the window, while in this app only
 * the shell's `<main>` scrolls.
 */
export const RETURN_NAVIGATION: NavigationBehaviorOptions = { replaceUrl: true, info: RETURNING };

export function isReturnNavigation(info: unknown): boolean {
  return info === RETURNING;
}

/** Enough for every screen in a back stack plus the primary destinations, and then some. */
const MAX_ENTRIES = 30;

/** How long a restore holds the position while the page's content is still arriving. */
const RESTORE_TIMEOUT_MS = 1000;

/**
 * Remembers how far each screen was scrolled, keyed by its URL, and scrolls back there.
 *
 * Owned by `MainNavigationScaffold`, which decides when a screen is being returned to.
 */
export class ScrollMemory {
  private readonly positions = new Map<string, number>();
  private cancelRestore: (() => void) | null = null;

  constructor(private readonly serializer: UrlSerializer) {}

  save(url: string, top: number): void {
    const key = this.key(url);
    // Re-inserted, so the oldest entry is the least recently left one.
    this.positions.delete(key);
    this.positions.set(key, top);
    if (this.positions.size > MAX_ENTRIES) {
      this.positions.delete(this.positions.keys().next().value!);
    }
  }

  /** The URL without its query string and fragment, i.e. which screen it opens. */
  screenOf(url: string): string {
    const tree = this.serializer.parse(url);
    tree.queryParams = {};
    tree.fragment = null;
    return this.serializer.serialize(tree);
  }

  /** Scrolls `region` back to where it was when `url` was left, or to the top if it never was. */
  restore(region: HTMLElement, url: string): void {
    this.stop();
    const top = this.positions.get(this.key(url)) ?? 0;

    // The page is not finished yet: its lists come from the database after the first render, with
    // placeholders of a different height until then. Left alone, the browser's scroll anchoring
    // would follow whatever happened to be on screen during that swap, and an offset applied before
    // the page is tall enough is clamped. So for a moment the position is held: anchoring is off,
    // and it is applied again whenever the page changes size - but never against the user, who may
    // already be scrolling.
    region.style.overflowAnchor = 'none';
    const resizes = new ResizeObserver(() => (region.scrollTop = top));
    Array.from(region.children).forEach((child) => resizes.observe(child));
    const userEvents = ['touchstart', 'wheel', 'keydown'] as const;
    const stop = () => {
      clearTimeout(timeout);
      resizes.disconnect();
      userEvents.forEach((type) => region.removeEventListener(type, stop));
      region.style.overflowAnchor = '';
      this.cancelRestore = null;
    };
    const timeout = setTimeout(stop, RESTORE_TIMEOUT_MS);
    userEvents.forEach((type) => region.addEventListener(type, stop, { passive: true }));
    this.cancelRestore = stop;

    region.scrollTop = top;
  }

  /** Abandons a restore still waiting for its page, e.g. because the user navigated on. */
  stop(): void {
    this.cancelRestore?.();
  }

  /**
   * The query parameters in a fixed order, because they are part of what the screen shows (the
   * calendar's day and view), but the same screen may be linked with them in any order.
   */
  private key(url: string): string {
    const tree = this.serializer.parse(url);
    const query = Object.keys(tree.queryParams)
      .sort()
      .map((name) => `${name}=${String(tree.queryParams[name])}`)
      .join('&');
    return `${this.screenOf(url)}?${query}`;
  }
}
