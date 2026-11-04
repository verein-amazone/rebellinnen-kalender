import { inject, Injectable } from '@angular/core';

import {
  DeviceSiriAndSearch,
  type SearchDomain,
  type SearchEntry,
} from '@app/cross-cutting/infrastructure/siri-and-search';
import { BookmarksInteractor } from '@app/interactors/saved-content/bookmarks.interactor';
import { SupportServicesInteractor } from '@app/interactors/support-services/support-services.interactor';

import { bookmarkEntry, supportServiceEntry } from './search-entries';

/**
 * What iOS search lists of the app (#167): every Anlaufstelle, and every item bookmarked in Meine
 * Sammlung. Never appointments, notes or anything else personal, and never undiscovered content -
 * search must not get ahead of the app revealing it over time. Where a tapped result leads is
 * `ExternalDestinationsInteractor`'s.
 *
 * There is no switch in the app: whoever does not want the app in their search turns it off for the
 * app in the iOS settings („Siri & Suche“).
 *
 * `sync()` simply writes both domains again - a few dozen entries, cheap enough for every start and
 * every bookmark change, and it repairs whatever the OS may have dropped without the app tracking
 * what it holds. Calls are serialized and coalesced like `ReminderSchedulerInteractor.reschedule()`.
 */
@Injectable({ providedIn: 'root' })
export class SiriAndSearchInteractor {
  private readonly device = inject(DeviceSiriAndSearch);
  private readonly supportServices = inject(SupportServicesInteractor);
  private readonly bookmarks = inject(BookmarksInteractor);

  private running: Promise<void> | null = null;
  private requested = false;

  sync(): Promise<void> {
    this.requested = true;
    this.running ??= this.drain().finally(() => (this.running = null));
    return this.running;
  }

  /** Removes everything the app put into iOS search, e.g. before all app data is cleared. */
  clearAll(): Promise<void> {
    return this.device.deleteAll();
  }

  private async drain(): Promise<void> {
    while (this.requested) {
      this.requested = false;
      if (!this.device.isSupported()) {
        continue;
      }
      // One domain that could not be written must not hold back the other.
      await this.write('support-services', async () =>
        (await this.supportServices.listAll()).map(supportServiceEntry),
      );
      await this.write('content-bookmarks', async () =>
        (await this.bookmarks.listSavedItems()).map(bookmarkEntry),
      );
    }
  }

  private async write(domain: SearchDomain, entries: () => Promise<SearchEntry[]>): Promise<void> {
    try {
      await this.device.replaceDomain(domain, await entries());
    } catch (error) {
      // iOS search is a convenience; a failed write is repeated on the next start or change.
      console.warn(`Die iOS-Suche (${domain}) konnte nicht aktualisiert werden.`, error);
    }
  }
}
