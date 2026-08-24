import { DOCUMENT, inject, Injectable, Injector, type Type } from '@angular/core';
import { hasModifierKey } from '@angular/cdk/keycodes';
import {
  createBlockScrollStrategy,
  createGlobalPositionStrategy,
  createOverlayRef,
  OverlayConfig,
} from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { filter } from 'rxjs/operators';

import { PageFocus } from '@app/cross-cutting/infrastructure/page-focus';

import { Sheet } from './sheet';
import {
  SHEET_CONFIG,
  SHEET_CONTENT,
  SHEET_DATA,
  type ResolvedSheetConfig,
  type SheetConfig,
  SheetRef,
} from './sheet-ref';

/**
 * Opens modal sheets.
 *
 * Built on the CDK overlay rather than `CdkDialog`, so everything a modal owes the user is wired
 * here explicitly: the dialog role, the focus trap, inert content behind it, blocked scrolling,
 * Escape, the backdrop and focus restoration. Getting this right once is the reason the primitive
 * exists at all.
 */
@Injectable({ providedIn: 'root' })
export class SheetService {
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  private readonly pageFocus = inject(PageFocus);

  /** Nested sheets each hold the shell inert; only the last one out clears it. */
  private openCount = 0;

  open<TResult = undefined, TData = undefined>(
    content: Type<unknown>,
    config: SheetConfig<TData>,
  ): SheetRef<TResult> {
    const resolved: ResolvedSheetConfig = {
      heading: config.heading,
      mode: config.mode ?? 'bottom',
      dismissible: config.dismissible ?? true,
      dismissLabel: config.dismissLabel ?? 'Schließen',
    };

    const previouslyFocused = this.document.activeElement as HTMLElement | null;

    const overlayRef = createOverlayRef(
      this.injector,
      new OverlayConfig({
        hasBackdrop: true,
        backdropClass: ['cdk-overlay-dark-backdrop', 'rk-sheet-backdrop'],
        panelClass: 'rk-sheet-pane',
        positionStrategy: createGlobalPositionStrategy(this.injector)
          .bottom('0')
          .centerHorizontally(),
        // The overlay does not block page scrolling on its own; without this the page behind the
        // sheet scrolls under the user's finger.
        scrollStrategy: createBlockScrollStrategy(this.injector),
        width: '100%',
        maxWidth: '100%',
        // A navigation triggered from inside the sheet must not leave it hanging over the new page.
        disposeOnNavigation: true,
      }),
    );

    const sheetRef = new SheetRef<TResult>(resolved, () => overlayRef.dispose());

    const portalInjector = Injector.create({
      parent: this.injector,
      providers: [
        { provide: SheetRef, useValue: sheetRef },
        { provide: SHEET_CONFIG, useValue: resolved },
        { provide: SHEET_CONTENT, useValue: content },
        { provide: SHEET_DATA, useValue: config.data },
        ...(config.providers ?? []),
      ],
    });

    overlayRef.attach(new ComponentPortal(Sheet, null, portalInjector));

    this.openCount += 1;
    this.setShellInert(true);

    if (resolved.dismissible) {
      overlayRef.backdropClick().subscribe(() => sheetRef.dismiss());
      overlayRef
        .keydownEvents()
        .pipe(filter((event) => event.key === 'Escape' && !hasModifierKey(event)))
        .subscribe((event) => {
          // Otherwise Escape also clears the focused input or leaves fullscreen on the way out.
          event.preventDefault();
          sheetRef.dismiss();
        });
    }

    // Fires for `dispose()` as well as for a teardown we did not initiate, such as a navigation.
    overlayRef.detachments().subscribe(() => {
      this.openCount = Math.max(0, this.openCount - 1);
      if (this.openCount === 0) {
        this.setShellInert(false);
      }

      // The opener is often gone by now, because the sheet's action navigated away from it.
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      } else {
        this.pageFocus.focusPageHeading();
      }

      sheetRef.settle();
    });

    return sheetRef;
  }

  /**
   * `aria-modal` hides the rest of the page from assistive technology, but does nothing for Tab or
   * for a pointer. `inert` on the app shell covers both. The overlay container is a sibling of the
   * shell, so the sheet itself stays interactive.
   */
  private setShellInert(inert: boolean): void {
    const shell = this.document.querySelector('app-root');
    if (shell === null) {
      return;
    }

    if (inert) {
      shell.setAttribute('inert', '');
    } else {
      shell.removeAttribute('inert');
    }
  }
}
