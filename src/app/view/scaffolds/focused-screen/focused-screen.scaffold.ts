import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  computed,
  contentChild,
  inject,
  input,
} from '@angular/core';
import { LucideArrowLeft, LucideX } from '@lucide/angular';
import { Router } from '@angular/router';

/**
 * How the screen is dismissed.
 *
 * - `back` - the screen was navigated into and the user returns the way they came (details,
 *   settings subpages). Rendered as a back arrow.
 * - `close` - the screen is a self-contained task the user leaves without completing it (creating
 *   or editing). Rendered as a close cross, because a back arrow would suggest that whatever was
 *   entered is kept.
 */
export type FocusedScreenDismissal = 'back' | 'close';

/**
 * Layout for a focused screen: a header with a single dismiss action, the screen title, and the
 * screen's content.
 *
 * Focused screens are routes without a `data.tab`, so `MainNavigationScaffold` hides the bottom
 * navigation while one is open. Every focused screen uses this scaffold so dismissal behaviour
 * stays identical everywhere. Focus is handled centrally by `PageFocus` on navigation, not here.
 *
 * Dismissing always navigates to an explicitly declared target - `returnTo` when the caller passed
 * one, `fallbackLink` otherwise - and replaces the current history entry rather than pushing a new
 * one. It deliberately does not walk the browser history: a history-based back combined with a
 * pushed dismiss navigation makes the two screens point at each other, and the user is stuck
 * alternating between them (a deep-linked settings subpage, or any detail screen opened with
 * `returnTo`, reproduced exactly that). Replacing also keeps the stack from growing, so the
 * platform back gesture leaves the screen instead of re-entering it.
 */
@Component({
  selector: 'app-focused-screen',
  // Component hosts are unknown elements and therefore inline by default.
  host: { class: 'block' },
  imports: [LucideArrowLeft, LucideX],
  templateUrl: './focused-screen.scaffold.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FocusedScreenScaffold {
  readonly heading = input.required<string>();
  /** Where dismissing goes: the screen's parent, unless `returnTo` overrides it. */
  readonly fallbackLink = input<string>('/today');
  /**
   * Where dismissing goes when the caller knows better than the static parent - a detail screen
   * reached from several places carries the origin in a `?returnTo=` query param and passes it
   * here, so leaving it returns to the list the user actually came from.
   */
  readonly returnTo = input<string | null>(null);
  readonly dismissal = input<FocusedScreenDismissal>('back');
  /** Accessible name of the dismiss action. Override where the default is not specific enough. */
  readonly dismissLabel = input<string | null>(null);
  /**
   * Lets a screen that edits in place (e.g. a detail page toggling into an edit view without
   * navigating) intercept the dismiss action. Called before the default back/close navigation; a
   * `true` return means the caller already handled it (e.g. stepped out of edit mode) and the
   * scaffold does nothing further. A `false` return, or omitting this input entirely, runs the
   * default navigation exactly as before.
   */
  readonly beforeDismiss = input<(() => boolean) | undefined>();

  private readonly router = inject(Router);

  /** Set via a template reference variable (`#focusedScreenFooter`) on the projected footer content. */
  protected readonly footerContent = contentChild<ElementRef>('focusedScreenFooter');
  protected readonly hasFooter = computed(() => this.footerContent() != null);

  protected readonly resolvedDismissLabel = computed(
    () => this.dismissLabel() ?? (this.dismissal() === 'close' ? 'Schließen' : 'Zurück'),
  );

  protected dismiss(): void {
    if (this.beforeDismiss()?.() === true) {
      return;
    }

    void this.router.navigateByUrl(this.returnTo() ?? this.fallbackLink(), { replaceUrl: true });
  }
}
