import { Injectable, signal } from '@angular/core';

/**
 * A version counter bumped every time a reminder is written - added, ticked, reopened, renamed,
 * moved or removed.
 *
 * The reminders list holds its own state in `ReminderListBlock`'s `resource()`; this is what lets
 * the Today page's closing message, a sibling block with no other view of that state, notice a
 * write happened and reload without the two blocks knowing about each other directly.
 */
@Injectable({ providedIn: 'root' })
export class ReminderChanges {
  private readonly versionState = signal(0);

  readonly version = this.versionState.asReadonly();

  notify(): void {
    this.versionState.update((version) => version + 1);
  }
}
