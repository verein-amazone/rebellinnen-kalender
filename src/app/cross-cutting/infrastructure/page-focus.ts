import { DOCUMENT, inject, Injectable } from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';

/**
 * Focus and announcement handling for navigation.
 *
 * Every screen renders exactly one `<h1>` inside the shell's `<main>` landmark, which is what both
 * methods below target.
 *
 * Moving focus and announcing are deliberately separate: pulling focus is right when the context
 * changes completely (a focused screen opens or closes), but wrong while the user is operating the
 * bottom navigation, because it would throw a keyboard user out of the control they are using.
 */
@Injectable({ providedIn: 'root' })
export class PageFocus {
  private readonly document = inject(DOCUMENT);
  private readonly announcer = inject(LiveAnnouncer);

  /** Move focus to the current screen's title, so its name is announced and reading starts there. */
  focusPageHeading(): void {
    const heading = this.pageHeading();
    if (heading === null) {
      return;
    }

    // `-1` makes the heading programmatically focusable without adding a tab stop.
    heading.setAttribute('tabindex', '-1');
    heading.focus();
  }

  /** Announce the current screen's title without taking focus away from the user. */
  announcePageHeading(): void {
    const title = this.pageHeading()?.textContent?.trim();
    if (title !== undefined && title !== '') {
      void this.announcer.announce(title, 'polite');
    }
  }

  private pageHeading(): HTMLElement | null {
    return this.document.querySelector<HTMLElement>('main h1');
  }
}
