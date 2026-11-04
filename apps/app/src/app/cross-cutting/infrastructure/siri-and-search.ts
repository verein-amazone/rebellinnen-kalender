import { inject, Injectable } from '@angular/core';

import { DevicePlatformService } from '@app/cross-cutting/infrastructure/device-platform';
import { SIRI_AND_SEARCH_PLUGIN } from '@app/cross-cutting/plugins/siri-and-search.plugin';

/** The app's groups of entries in iOS search, each replaced on its own. */
export type SearchDomain = 'support-services' | 'content-bookmarks';

/** One entry in iOS search - plugin-free. `id` is also the destination a tap on it opens. */
export interface SearchEntry {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly keywords: readonly string[];
}

/**
 * iOS search (Spotlight) and the App Shortcuts, wrapping the app's own plugin (see
 * `../plugins/siri-and-search.plugin.ts`).
 *
 * Only the iOS app has them; everywhere else this reports itself as unsupported and every call is
 * a no-op. `replaceDomain` rejects on failure so the caller can report it and try again later;
 * `donate` and `deleteAll` swallow it - a missed donation only weakens a suggestion, and `deleteAll`
 * runs on the way to a reset, like `DeviceNotifications.cancelAll`.
 */
@Injectable({ providedIn: 'root' })
export class DeviceSiriAndSearch {
  private readonly plugin = inject(SIRI_AND_SEARCH_PLUGIN);
  private readonly platform = inject(DevicePlatformService);

  isSupported(): boolean {
    return this.platform.platform === 'ios';
  }

  /** Makes `entries` the complete content of `domain`. */
  async replaceDomain(domain: SearchDomain, entries: readonly SearchEntry[]): Promise<void> {
    if (!this.isSupported()) {
      return;
    }
    await this.plugin.replaceDomain({ domain, items: entries });
  }

  /**
   * Tells iOS the App Shortcut screen `destination` (`today`, `collection`, `services` or
   * `new-event`) was opened inside the app, so Siri can learn when to suggest it.
   */
  async donate(destination: string): Promise<void> {
    if (!this.isSupported()) {
      return;
    }
    try {
      await this.plugin.donate({ destination });
    } catch {
      // See the class comment.
    }
  }

  /** Removes the app's entries in iOS search and its donations. */
  async deleteAll(): Promise<void> {
    if (!this.isSupported()) {
      return;
    }
    try {
      await this.plugin.deleteAll();
    } catch {
      // See the class comment.
    }
  }

  /**
   * Calls `handler` with every destination a Spotlight result or an App Shortcut opens, including
   * the one that launched the app: the plugin keeps that until a listener is registered. Returns a
   * function that stops listening.
   */
  onDestinationOpened(handler: (destination: string) => void): () => void {
    if (!this.isSupported()) {
      return () => undefined;
    }

    let stopped = false;
    let remove: (() => Promise<void>) | null = null;
    void this.plugin
      .addListener('destinationOpened', ({ destination }) => {
        if (typeof destination === 'string') {
          handler(destination);
        }
      })
      .then((handle) => {
        remove = () => handle.remove();
        if (stopped) {
          void remove();
        }
      })
      .catch(() => undefined);

    return () => {
      stopped = true;
      void remove?.();
    };
  }
}
