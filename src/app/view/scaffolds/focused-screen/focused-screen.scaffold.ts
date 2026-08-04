import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { Location } from '@angular/common';
import { LucideArrowLeft } from '@lucide/angular';
import { Router } from '@angular/router';

/**
 * Layout for a focused screen: a header with a single back action, the screen title, and the
 * screen's content.
 *
 * Focused screens are routes without a `data.tab`, so `MainNavigationScaffold` hides the bottom
 * navigation while one is open. Every focused screen uses this scaffold so back and close
 * behaviour stays identical everywhere.
 *
 * Going back prefers the browser history, which returns users to the exact context they came from
 * (including any state carried in the previous URL). When there is no in-app history — the screen
 * was deep-linked or restored — it navigates to `fallbackLink` instead.
 */
@Component({
  selector: 'app-focused-screen',
  // Component hosts are unknown elements and therefore inline by default.
  host: { class: 'block' },
  imports: [LucideArrowLeft],
  templateUrl: './focused-screen.scaffold.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FocusedScreenScaffold {
  readonly heading = input.required<string>();
  /** Where to go when there is no in-app history to return to. */
  readonly fallbackLink = input<string>('/today');
  /** Accessible name of the back action. Override it where "Zurück" is not specific enough. */
  readonly backLabel = input<string>('Zurück');

  private readonly location = inject(Location);
  private readonly router = inject(Router);

  protected readonly headingElement = viewChild.required<ElementRef<HTMLElement>>('headingElement');

  constructor() {
    // Move focus to the title when the screen opens, so assistive technology announces the new
    // context instead of leaving focus on the control that opened it.
    afterNextRender(() => this.headingElement().nativeElement.focus());
  }

  protected goBack(): void {
    if (this.router.lastSuccessfulNavigation()?.previousNavigation != null) {
      this.location.back();
      return;
    }

    void this.router.navigateByUrl(this.fallbackLink());
  }
}
