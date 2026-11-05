import { Injectable, signal } from '@angular/core';

/**
 * A version counter bumped every time a bookmark is added or removed.
 *
 * It lets a resource with no other view of bookmark state (e.g. the My Collection list) notice a
 * bookmark toggle happened elsewhere and reload, without the two features knowing about each other
 * directly.
 */
@Injectable({ providedIn: 'root' })
export class BookmarkChanges {
  private readonly versionState = signal(0);

  readonly version = this.versionState.asReadonly();

  notify(): void {
    this.versionState.update((version) => version + 1);
  }
}
