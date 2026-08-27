import { Injectable, signal } from '@angular/core';
import { AccessibilityPreferences } from '@capawesome/capacitor-accessibility-preferences';
import { App } from '@capacitor/app';
import { TextZoom } from '@capacitor/text-zoom';

import { devicePlatform } from './device-platform';

/**
 * The text scale the operating system asks for, as a plain number.
 *
 * This is the only place the accessibility and text-zoom plugins are used, so no Capacitor type
 * reaches an interactor or a view. `1` means "default size" and is what every caller sees until the
 * real value is known - and on the web, where the browser does not expose the setting at all.
 *
 * Two platform problems are handled here:
 *
 * 1. iOS WKWebView ignores Dynamic Type completely: the root font size stays at 16px no matter where
 *    the Larger Text slider is. Reading `fontScale` and applying it in CSS is what closes that gap.
 * 2. Android WebView applies the system font scale as `textZoom`, which scales computed font sizes
 *    but not lengths, so text grows while padding, gaps and heights stay put - that is how content
 *    ends up overlapping. Resetting `textZoom` to 1 takes ownership of scaling: with the root font
 *    size doing the work instead, the rem-based spacing scale grows along with the text.
 *
 * Neither platform fires a change event, so the value is re-read whenever the app becomes active.
 */
@Injectable({ providedIn: 'root' })
export class SystemTextScale {
  private readonly scaleState = signal(1);

  /** The OS text scale. `1` is the default size; iOS reaches 3.12 at its largest setting. */
  readonly scale = this.scaleState.asReadonly();

  /**
   * Reads the initial value and keeps it up to date.
   *
   * Awaited during bootstrap: applying the scale after the first paint would show the app at the
   * wrong size for a frame. The `textZoom` reset does not survive a restart either, so it has to be
   * repeated on every boot.
   */
  async initialize(): Promise<void> {
    await this.refresh();

    await App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        void this.refresh();
      }
    });
  }

  /** Re-reads the OS preference. Failures leave the last known scale in place. */
  async refresh(): Promise<void> {
    if (devicePlatform() === 'android') {
      try {
        await TextZoom.set({ value: 1 });
      } catch {
        // The reset failed, so Android is still applying its own zoom. Leaving the scale at 1 keeps
        // that single scaling in place; applying ours on top would double-scale.
        return;
      }
    }

    try {
      const { fontScale } = await AccessibilityPreferences.getPreferences();
      if (Number.isFinite(fontScale) && fontScale > 0) {
        this.scaleState.set(fontScale);
      }
    } catch {
      // Same reasoning: the default scale is a usable app, a failed startup is not.
    }
  }
}
