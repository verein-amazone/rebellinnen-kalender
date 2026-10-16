import { InjectionToken } from '@angular/core';
import { TextZoom } from '@capacitor/text-zoom';

/** The slice of the WebView text-zoom plugin this app uses. */
export interface TextZoomPlugin {
  set(options: { value: number }): Promise<void>;
}

/**
 * The WebView text-zoom plugin. See ./README.md for why it is behind a token, and `app.plugin.ts`
 * for why the token holds a plain object rather than the plugin proxy.
 */
export const TEXT_ZOOM_PLUGIN = new InjectionToken<TextZoomPlugin>('TEXT_ZOOM_PLUGIN', {
  providedIn: 'root',
  factory: () => ({ set: (options) => TextZoom.set(options) }),
});
