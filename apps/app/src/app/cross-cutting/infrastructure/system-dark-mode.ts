import { DestroyRef, inject, Injectable, signal } from '@angular/core';

const QUERY = '(prefers-color-scheme: dark)';

/**
 * Whether the device is in dark mode, kept current while the app runs.
 *
 * Both WebViews report the OS setting through the media query: WKWebView because Info.plist sets no
 * `UIUserInterfaceStyle`, the Android WebView (target SDK 33+) because `AppTheme.NoActionBar`, the
 * theme Capacitor switches the activity to after the splash, is a `DayNight` one. The change event
 * fires when the user flips the setting, including from Control Centre while the app stays open.
 * `matchMedia` is missing in non-browser environments (unit tests, SSR), where light is the right
 * answer anyway.
 */
@Injectable({ providedIn: 'root' })
export class SystemDarkMode {
  private readonly darkState = signal(false);

  readonly dark = this.darkState.asReadonly();

  constructor() {
    const media = globalThis.matchMedia?.(QUERY);
    if (media === undefined) {
      return;
    }

    this.darkState.set(media.matches);
    const onChange = (event: MediaQueryListEvent): void => this.darkState.set(event.matches);
    media.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy(() => media.removeEventListener('change', onChange));
  }
}
