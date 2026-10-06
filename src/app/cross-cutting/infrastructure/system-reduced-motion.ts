import { DestroyRef, inject, Injectable, signal } from '@angular/core';

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Whether the device asks for reduced motion, kept current while the app runs.
 *
 * CSS answers this by itself through the media query in `base.css`; this is for the few places
 * that have to know in code - a programmatic scroll, or a settings screen explaining why the
 * Tagesimpuls holds still. `matchMedia` is missing in non-browser environments (unit tests, SSR),
 * where "no stated preference" is the right answer anyway.
 */
@Injectable({ providedIn: 'root' })
export class SystemReducedMotion {
  private readonly reducedState = signal(false);

  readonly reduced = this.reducedState.asReadonly();

  constructor() {
    const media = globalThis.matchMedia?.(QUERY);
    if (media === undefined) {
      return;
    }

    this.reducedState.set(media.matches);
    const onChange = (event: MediaQueryListEvent): void => this.reducedState.set(event.matches);
    media.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy(() => media.removeEventListener('change', onChange));
  }
}
