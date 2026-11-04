import { inject, Injectable } from '@angular/core';

import { AppDataReset } from '@app/data/maintenance/app-data-reset';
import { ReminderSchedulerInteractor } from '@app/interactors/notifications/reminder-scheduler.interactor';
import { SiriAndSearchInteractor } from '@app/interactors/siri-and-search/siri-and-search.interactor';

/**
 * Development-only application state management: throwing away everything the app has stored, so a
 * first-run path (the Tagesimpuls arrival animation, an empty collection, the seeded calendars) can
 * be exercised again without reinstalling the app.
 */
@Injectable({ providedIn: 'root' })
export class AppDataInteractor {
  private readonly reset = inject(AppDataReset);
  private readonly reminders = inject(ReminderSchedulerInteractor);
  private readonly siriAndSearch = inject(SiriAndSearchInteractor);

  /**
   * Clears every stored row and preference. In-memory signals in the stores still hold the old
   * values afterwards, so the caller is expected to restart the app rather than keep running.
   */
  async resetAppData(): Promise<void> {
    // Pending reminders and iOS search entries live with the OS, outside the data being cleared;
    // they would otherwise still fire for appointments, or list bookmarks, that no longer exist.
    await this.reminders.cancelAll();
    await this.siriAndSearch.clearAll();
    await this.reset.clearEverything();
  }
}
