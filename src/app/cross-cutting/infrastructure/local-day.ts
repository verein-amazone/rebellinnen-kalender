import { DestroyRef, inject, Injectable, signal } from '@angular/core';

import { AppLifecycle } from './app-lifecycle';

/** How often the day is re-checked while the app stays open. */
const CHECK_INTERVAL_MS = 60_000;

/**
 * The current local calendar day, for screens that show something "for today".
 *
 * The signal carries `YYYY-MM-DD` rather than a `Date` on purpose: a date object would be a new value
 * on every check and would retrigger everything reading it once a minute. A day key only changes when
 * the day actually does.
 *
 * Two sources write it, because neither covers every case on its own: the interval catches an app
 * left open across midnight, and `AppLifecycle` catches a phone that was asleep for hours.
 */
@Injectable({ providedIn: 'root' })
export class LocalDay {
  private readonly dayState = signal(currentDay());

  /** The local day as `YYYY-MM-DD`. Emits exactly once per day change, never oftener. */
  readonly day = this.dayState.asReadonly();

  constructor() {
    const interval = setInterval(() => this.refresh(), CHECK_INTERVAL_MS);
    const stopWatchingResumes = inject(AppLifecycle).onResume(() => this.refresh());

    inject(DestroyRef).onDestroy(() => {
      clearInterval(interval);
      stopWatchingResumes();
    });
  }

  /** Re-reads the clock. The signal only changes when the day did, so a check is otherwise free. */
  refresh(): void {
    const today = currentDay();
    if (today !== this.dayState()) {
      this.dayState.set(today);
    }
  }
}

/**
 * The local day as `YYYY-MM-DD`. Built from the local getters rather than `toISOString`, which would
 * return the UTC day and be wrong for most of the evening in this app's time zone.
 */
function currentDay(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');

  return `${now.getFullYear()}-${month}-${day}`;
}
