import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { LucideInfo } from '@lucide/angular';

import { HardwareBack } from '@app/cross-cutting/infrastructure/hardware-back';

let nextId = 0;

/**
 * An info button that shows a short explanation next to it, so a screen does not have to carry
 * text that is only needed the first time someone uses it.
 *
 * The disclosure pattern rather than a tooltip, a popover or a dialog: the trigger is a native
 * `<button>` with `aria-expanded`, and the explanation is rendered right after it in the DOM, so a
 * screen reader reaches it with the next swipe and nothing has to be announced or focused. It only
 * floats visually. Being non-modal, it traps nothing; it closes on the button again, a tap anywhere
 * else, Escape and Android's back button. The native `popover` attribute would do the dismissing for
 * us, but iOS 16.4 - the minimum - does not support it.
 *
 * Place it at the end of a row - a focused screen's `header-actions` or a header's last column -
 * because the panel opens below the button and extends towards the start.
 */
@Component({
  selector: 'app-info-toggletip',
  // Anchors the absolutely positioned panel. Component hosts are inline by default.
  host: {
    class: 'relative inline-flex',
    '(document:pointerdown)': 'closeOnOutsidePointer($event)',
    '(keydown.escape)': 'closeAndRefocus($event)',
  },
  imports: [LucideInfo],
  templateUrl: './info-toggletip.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InfoToggletip {
  /** The button's accessible name: what it explains, e.g. „Info zu Meine Sammlung“. */
  readonly label = input.required<string>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly hardwareBack = inject(HardwareBack);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');

  protected readonly open = signal(false);
  protected readonly panelId = `app-info-toggletip-${nextId++}`;

  constructor() {
    // Registered only while open, so the back button keeps leaving the screen otherwise.
    effect((onCleanup) => {
      if (this.open()) {
        onCleanup(
          this.hardwareBack.register(() => {
            this.open.set(false);
            return true;
          }),
        );
      }
    });
  }

  protected toggle(): void {
    this.open.update((open) => !open);
  }

  protected closeOnOutsidePointer(event: PointerEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node | null)) {
      this.open.set(false);
    }
  }

  /** Escape from inside the panel would otherwise leave focus on an element that is gone. */
  protected closeAndRefocus(event: Event): void {
    if (!this.open()) {
      return;
    }

    event.preventDefault();
    const focusWasInside = this.host.nativeElement.contains(this.document.activeElement);
    this.open.set(false);
    if (focusWasInside) {
      this.trigger().nativeElement.focus();
    }
  }
}
