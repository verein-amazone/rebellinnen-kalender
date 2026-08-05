import { NgComponentOutlet } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  viewChild,
} from '@angular/core';
import { ConfigurableFocusTrapFactory, type FocusTrap } from '@angular/cdk/a11y';
import { LucideX } from '@lucide/angular';

import { SHEET_CONFIG, SHEET_CONTENT, SheetRef } from './sheet-ref';

/**
 * How long to wait for the exit animation before tearing down anyway. Longer than the 180ms
 * animation, and short enough not to feel stuck.
 */
const EXIT_TIMEOUT_MS = 300;

/** Module-level so heading ids are stable and predictable in tests. */
let nextId = 0;

/**
 * The chrome around a sheet's content: the panel, the heading, the dismiss button and the exit
 * animation. `SheetService` creates it; nothing should reference it directly.
 *
 * The content of a sheet is a presenter and belongs in `view/dialogs/`, not here.
 */
@Component({
  selector: 'app-sheet',
  imports: [NgComponentOutlet, LucideX],
  templateUrl: './sheet.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sheet {
  protected readonly config = inject(SHEET_CONFIG);
  protected readonly content = inject(SHEET_CONTENT);
  protected readonly sheetRef = inject(SheetRef);
  /** The sheet was created with an injector carrying SHEET_DATA and SheetRef; the content needs it. */
  protected readonly contentInjector = inject(Injector);
  protected readonly headingId = `rk-sheet-heading-${++nextId}`;

  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  private readonly focusTrapFactory = inject(ConfigurableFocusTrapFactory);
  private focusTrap: FocusTrap | null = null;

  constructor() {
    /*
     * The trap is created by hand rather than with the `cdkTrapFocus` directive for two reasons: we
     * want focus to enter only once the panel has been laid out, and the directive's auto-capture
     * restores focus on destroy, which SheetService already does — and does better, because it can
     * fall back to the page heading when the opener is gone.
     */
    afterNextRender(() => {
      this.focusTrap = this.focusTrapFactory.create(this.panel().nativeElement);
      void this.focusTrap.focusInitialElementWhenReady();
    });

    effect((onCleanup) => {
      if (!this.sheetRef.closing()) {
        return;
      }

      const element = this.panel().nativeElement;
      let finished = false;
      const finish = () => {
        if (finished) {
          return;
        }
        finished = true;
        this.sheetRef.finish();
      };

      element.addEventListener('animationend', finish, { once: true });
      /*
       * The timeout is not belt-and-braces: jsdom never runs CSS animations, so `animationend` will
       * not fire in a unit test at all. Under reduced motion the animation is shortened to 0.01ms
       * rather than removed, so there `animationend` still arrives first.
       */
      const timer = setTimeout(finish, EXIT_TIMEOUT_MS);

      onCleanup(() => {
        clearTimeout(timer);
        element.removeEventListener('animationend', finish);
      });
    });

    inject(DestroyRef).onDestroy(() => this.focusTrap?.destroy());
  }
}
