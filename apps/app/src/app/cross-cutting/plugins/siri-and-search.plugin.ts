import { InjectionToken } from '@angular/core';
import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

/** One entry in iOS search, as `SiriAndSearchPlugin.swift` reads it. */
export interface SearchableItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly keywords: readonly string[];
}

/** The app's own iOS plugin (`ios/App/App/SiriAndSearchPlugin.swift`); there is no npm package. */
export interface SiriAndSearchPlugin {
  replaceDomain(options: { domain: string; items: readonly SearchableItem[] }): Promise<void>;
  deleteAll(): Promise<void>;
  addListener(
    eventName: 'destinationOpened',
    listener: (event: { destination: string }) => void,
  ): Promise<PluginListenerHandle>;
}

/**
 * Spotlight and App Shortcuts (#167). See ./README.md for why it is behind a token, and for how a
 * plugin compiled into the app target is registered.
 *
 * Only iOS implements it. Registered lazily in the factory, and handed on as a plain object like
 * `CAPACITOR_APP`: a Capacitor plugin proxy answers *every* property, so Angular's DI would see an
 * `ngOnDestroy` on it.
 */
export const SIRI_AND_SEARCH_PLUGIN = new InjectionToken<SiriAndSearchPlugin>(
  'SIRI_AND_SEARCH_PLUGIN',
  {
    providedIn: 'root',
    factory: () => {
      const plugin = registerPlugin<SiriAndSearchPlugin>('SiriAndSearch');
      return {
        replaceDomain: (options) => plugin.replaceDomain(options),
        deleteAll: () => plugin.deleteAll(),
        addListener: (eventName, listener) => plugin.addListener(eventName, listener),
      };
    },
  },
);
