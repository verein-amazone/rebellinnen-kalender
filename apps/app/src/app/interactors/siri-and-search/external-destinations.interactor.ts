import { inject, Injectable } from '@angular/core';

import { DeviceSiriAndSearch } from '@app/cross-cutting/infrastructure/siri-and-search';

import { parseAppDestination, type AppDestination } from './app-destination';

/**
 * Where an iOS search result or an App Shortcut (#167) opens the app.
 *
 * Kept apart from `SiriAndSearchInteractor`, which decides what is indexed: listening has to start
 * with the app, while indexing pulls in the content and Anlaufstellen catalogs and is loaded
 * lazily after the first render.
 */
@Injectable({ providedIn: 'root' })
export class ExternalDestinationsInteractor {
  private readonly device = inject(DeviceSiriAndSearch);

  /**
   * Calls `handler` with where to navigate whenever a search result or an App Shortcut opens the
   * app, including the one that launched it. Returns the function that stops listening.
   */
  onDestinationOpened(handler: (destination: AppDestination) => void): () => void {
    return this.device.onDestinationOpened((raw) => {
      const destination = parseAppDestination(raw);
      if (destination !== null) {
        handler(destination);
      }
    });
  }
}
