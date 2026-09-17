import { Directive, ElementRef, inject, output, DestroyRef } from '@angular/core';

/** How far a pointer must travel horizontally before it counts as a swipe rather than a tap. */
const MIN_DISTANCE_PX = 48;

/** How much more horizontal than vertical the movement must be - roughly a 26° cone. */
const HORIZONTAL_DOMINANCE = 2;

/**
 * How long the one click a mouse drag synthesises may still arrive after the swipe.
 *
 * Short and one-shot on purpose: the browser fires that click in the same task as the release, so
 * anything longer would start swallowing the user's *next* tap - which is a real tap on a day.
 */
const CLICK_SUPPRESSION_MS = 200;

export type SwipeDirection = 'left' | 'right';

/**
 * Whether a pointer's travel reads as a horizontal swipe.
 *
 * In pixels, deliberately, not in `rem`: a gesture is finger-sized, and growing the threshold with
 * the text scale would make the calendar harder to page exactly for the people using large text.
 */
export function classifySwipe(dx: number, dy: number): SwipeDirection | null {
  if (Math.abs(dx) < MIN_DISTANCE_PX || Math.abs(dx) < HORIZONTAL_DOMINANCE * Math.abs(dy)) {
    return null;
  }

  return dx < 0 ? 'left' : 'right';
}

/**
 * Recognises a horizontal swipe on its host and reports the direction.
 *
 * Only ever an accelerator: the calendar's arrow buttons do the same thing and stay, because a
 * gesture can never be the only way to reach an action (see the touch-first rules in
 * docs/architecture/design-system.md).
 *
 * A single primary pointer only - a second one aborts, so pinch-zoom is never hijacked - and
 * `pointercancel` aborts too, which is what the browser sends once vertical scrolling takes the
 * gesture over. The host also needs `touch-action: pan-y pinch-zoom`, or the browser claims the
 * horizontal movement before these handlers see it.
 */
@Directive({
  selector: '[appHorizontalSwipe]',
  host: {
    '(pointerdown)': 'onPointerDown($event)',
    '(pointerup)': 'onPointerUp($event)',
    '(pointercancel)': 'cancel()',
  },
})
export class HorizontalSwipeDirective {
  /** A swipe towards the start of the row - "forwards", the way a paged calendar reads. */
  readonly swipeLeft = output<void>();
  /** A swipe towards the end of the row - backwards. In an RTL locale this pairing would flip. */
  readonly swipeRight = output<void>();

  private start: { pointerId: number; x: number; y: number } | null = null;
  private suppressClickUntil = 0;

  constructor() {
    const element = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;

    // Capture phase: a mouse drag still produces a click on release, and without this the day cell
    // under the cursor would be selected by the very gesture that paged away from it. Touch does
    // not synthesise a click after a moved finger, so this only ever fires for pointer devices.
    const onClick = (event: MouseEvent): void => {
      const suppress = performance.now() < this.suppressClickUntil;
      // Cleared either way: only the click belonging to the swipe is swallowed, never the one after.
      this.suppressClickUntil = 0;

      if (suppress) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    element.addEventListener('click', onClick, true);
    inject(DestroyRef).onDestroy(() => element.removeEventListener('click', onClick, true));
  }

  protected onPointerDown(event: PointerEvent): void {
    if (this.start !== null) {
      // A second pointer: this is a pinch or a two-finger scroll, not a swipe.
      this.cancel();
      return;
    }

    if (!event.isPrimary || event.button !== 0) {
      return;
    }

    this.start = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  }

  protected onPointerUp(event: PointerEvent): void {
    const start = this.start;
    this.start = null;

    if (start === null || start.pointerId !== event.pointerId) {
      return;
    }

    const direction = classifySwipe(event.clientX - start.x, event.clientY - start.y);
    if (direction === null) {
      return;
    }

    this.suppressClickUntil = performance.now() + CLICK_SUPPRESSION_MS;
    if (direction === 'left') {
      this.swipeLeft.emit();
    } else {
      this.swipeRight.emit();
    }
  }

  protected cancel(): void {
    this.start = null;
  }
}
