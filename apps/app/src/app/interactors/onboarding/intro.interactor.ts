import { computed, inject, Injectable } from '@angular/core';

import { IntroStore } from '@app/data/stores/intro.store';

/**
 * Whether the first-launch introduction (#82) still has to be shown, and where it resumes. Finishing
 * and skipping are the same to the app: either way the user has decided they have seen enough.
 */
@Injectable({ providedIn: 'root' })
export class IntroInteractor {
  private readonly store = inject(IntroStore);

  readonly hasSeen = computed(() => this.store.seenAt() !== null);
  /** The step an interrupted introduction continues on, 1-based. */
  readonly resumeStep = computed(() => this.store.step());

  /** Only while the introduction is still unfinished; a reopened one starts over every time. */
  rememberStep(step: number): void {
    if (!this.hasSeen()) {
      this.store.rememberStep(step);
    }
  }

  markSeen(): void {
    if (!this.hasSeen()) {
      this.store.markSeen(new Date().toISOString());
    }
  }

  /** Shows the introduction again on the next visit to Heute, from its first step. */
  reset(): void {
    this.store.reset();
  }
}
