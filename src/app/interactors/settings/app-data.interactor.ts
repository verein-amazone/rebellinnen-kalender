import { inject, Injectable } from '@angular/core';

import { AppDataReset } from '@app/data/maintenance/app-data-reset';

/**
 * Development-only application state management: throwing away everything the app has stored, so a
 * first-run path (the Tagesimpuls arrival animation, an empty collection, the seeded calendars) can
 * be exercised again without reinstalling the app.
 */
@Injectable({ providedIn: 'root' })
export class AppDataInteractor {
  private readonly reset = inject(AppDataReset);

  /**
   * Clears every stored row and preference. In-memory signals in the stores still hold the old
   * values afterwards, so the caller is expected to restart the app rather than keep running.
   */
  resetAppData(): Promise<void> {
    return this.reset.clearEverything();
  }
}
