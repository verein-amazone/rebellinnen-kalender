import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Location } from '@angular/common';
import { LucideArrowLeft, LucideX } from '@lucide/angular';
import { Router } from '@angular/router';

/**
 * How the screen is dismissed.
 *
 * - `back` — the screen was navigated into and the user returns the way they came (details,
 *   settings subpages). Rendered as a back arrow.
 * - `close` — the screen is a self-contained task the user leaves without completing it (creating
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
 * Dismissing prefers the browser history, which returns users to the exact context they came from
 * (including any state carried in the previous URL). When there is no in-app history — the screen
 * was deep-linked or restored — it navigates to `fallbackLink` instead.
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
  /** Where to go when there is no in-app history to return to. */
  readonly fallbackLink = input<string>('/today');
  readonly dismissal = input<FocusedScreenDismissal>('back');
  /** Accessible name of the dismiss action. Override where the default is not specific enough. */
  readonly dismissLabel = input<string | null>(null);

  private readonly location = inject(Location);
  private readonly router = inject(Router);

  protected readonly resolvedDismissLabel = computed(
    () => this.dismissLabel() ?? (this.dismissal() === 'close' ? 'Schließen' : 'Zurück'),
  );

  protected dismiss(): void {
    if (this.router.lastSuccessfulNavigation()?.previousNavigation != null) {
      this.location.back();
      return;
    }

    void this.router.navigateByUrl(this.fallbackLink());
  }
}
