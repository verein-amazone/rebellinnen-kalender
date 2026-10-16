import { DOCUMENT } from '@angular/common';
import { DestroyRef, effect, inject, Injectable, signal } from '@angular/core';

import { KEYBOARD_PLUGIN } from '@app/cross-cutting/plugins/keyboard.plugin';

import { DevicePlatformService } from './device-platform';

/** The CSS custom property on `<html>` that carries `KeyboardVisibility.inset`. */
export const KEYBOARD_INSET_PROPERTY = '--rk-keyboard-inset';

/** The CSS custom property on `<html>` that holds the shell's height on native platforms. */
export const APP_HEIGHT_PROPERTY = '--rk-app-height';

/**
 * Below this, a shrunken visual viewport is browser chrome (a collapsing URL bar) rather than a
 * keyboard, which is never this short.
 */
const MIN_WEB_KEYBOARD_HEIGHT = 120;

/**
 * How long a shrinking viewport waits for a keyboard to announce itself before the shell follows
 * it. Android resizes about 100ms before `keyboardWillShow`; anything else (split screen, a
 * shrinking window) is a real change of the app's size.
 */
const KEYBOARD_ANNOUNCEMENT_GRACE_MS = 400;

/**
 * Whether the on-screen keyboard is open, and how much of the bottom of the viewport it covers.
 *
 * The app never resizes for the keyboard - it would squeeze the whole shell, tab bar included, into
 * the space above it. Two custom properties on `<html>` carry that instead:
 *
 * - `--rk-app-height` (native only) is the shell's height, which follows the viewport except while
 *   the keyboard is open. iOS keeps the WebView's height anyway (Keyboard `resize: 'none'`,
 *   `capacitor.config.ts`), but on Android Capacitor's own system-bar handling pads the window by
 *   the keyboard whatever the manifest says - the viewport shrinks there, and only this keeps the
 *   shell, tab bar included, where it was.
 * - `--rk-keyboard-inset` is the part of the *viewport* the keyboard still covers: its full height
 *   where the viewport kept its size, 0 where the platform already shrank it to end at the keyboard.
 *   The sheet body pads itself by it, and the screen's scroll region by its share of the shell.
 *
 * Native platforms report the keyboard through `@capacitor/keyboard`. Its web implementation throws
 * on `addListener`, so the browser build measures the visual viewport instead, which a mobile
 * browser shrinks by the keyboard while leaving the layout viewport alone.
 */
@Injectable({ providedIn: 'root' })
export class KeyboardVisibility {
  private readonly plugin = inject(KEYBOARD_PLUGIN);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly visibleState = signal(false);
  private readonly insetState = signal(0);
  private readonly appHeightState = signal<number | null>(null);

  readonly visible = this.visibleState.asReadonly();

  /** How much of the viewport's bottom the keyboard covers, in CSS pixels; 0 while closed. */
  readonly inset = this.insetState.asReadonly();

  constructor() {
    const rootStyle = this.document.documentElement.style;
    effect(() => {
      rootStyle.setProperty(KEYBOARD_INSET_PROPERTY, `${this.insetState()}px`);
    });
    effect(() => {
      const appHeight = this.appHeightState();
      if (appHeight === null) {
        rootStyle.removeProperty(APP_HEIGHT_PROPERTY);
      } else {
        rootStyle.setProperty(APP_HEIGHT_PROPERTY, `${appHeight}px`);
      }
    });

    if (inject(DevicePlatformService).platform === 'web') {
      this.followVisualViewport();
    } else {
      this.followPlugin();
    }
  }

  private followPlugin(): void {
    const root = this.document.documentElement;
    const view = this.document.defaultView;
    let width = root.clientWidth;
    let pendingShrink: ReturnType<typeof setTimeout> | undefined;

    this.appHeightState.set(root.clientHeight);

    const followViewport = (): void => {
      clearTimeout(pendingShrink);
      const height = root.clientHeight;
      const appHeight = this.appHeightState() ?? height;

      // Growing, or a new width (rotation), is never the keyboard: follow at once. A shrink may be
      // the keyboard on its way in, so it only counts once no keyboard has claimed it.
      if (height >= appHeight || root.clientWidth !== width) {
        width = root.clientWidth;
        this.appHeightState.set(height);
        return;
      }
      pendingShrink = setTimeout(() => {
        if (!this.visibleState()) {
          this.appHeightState.set(root.clientHeight);
        }
      }, KEYBOARD_ANNOUNCEMENT_GRACE_MS);
    };
    view?.addEventListener('resize', followViewport);

    const showListener = this.plugin.addListener('keyboardWillShow', ({ keyboardHeight }) => {
      clearTimeout(pendingShrink);
      // Where the platform resizes for the keyboard (Android), that resize has already happened by
      // now. A shrink of at least half the keyboard means the viewport ends at the keyboard and
      // nothing in it is covered; otherwise (iOS) the keyboard covers its full height.
      const shrink = (this.appHeightState() ?? root.clientHeight) - root.clientHeight;
      const platformShrank = shrink >= keyboardHeight / 2;

      this.visibleState.set(true);
      this.insetState.set(platformShrank ? 0 : Math.max(0, keyboardHeight));
    });
    // `Will`, so the padding starts shrinking together with the keyboard's own closing animation.
    const willHideListener = this.plugin.addListener('keyboardWillHide', () => {
      this.insetState.set(0);
    });
    const didHideListener = this.plugin.addListener('keyboardDidHide', () => {
      this.visibleState.set(false);
      // Whatever happened while the keyboard was open (a rotation, say), this is the real size.
      width = root.clientWidth;
      this.appHeightState.set(root.clientHeight);
    });

    this.destroyRef.onDestroy(() => {
      clearTimeout(pendingShrink);
      view?.removeEventListener('resize', followViewport);
      for (const listener of [showListener, willHideListener, didHideListener]) {
        void listener.then((handle) => handle.remove());
      }
    });
  }

  private followVisualViewport(): void {
    const view = this.document.defaultView;
    const viewport = view?.visualViewport;
    if (viewport === null || viewport === undefined) {
      return;
    }

    const measure = (): void => {
      // A pinch zoom shrinks the visual viewport too; only an unzoomed one says "keyboard".
      const zoomed = Math.abs(viewport.scale - 1) > 0.01;
      const covered =
        this.document.documentElement.clientHeight - viewport.height - viewport.offsetTop;
      const inset = !zoomed && covered >= MIN_WEB_KEYBOARD_HEIGHT ? Math.round(covered) : 0;

      this.insetState.set(inset);
      this.visibleState.set(inset > 0);
    };

    viewport.addEventListener('resize', measure);
    viewport.addEventListener('scroll', measure);
    this.destroyRef.onDestroy(() => {
      viewport.removeEventListener('resize', measure);
      viewport.removeEventListener('scroll', measure);
    });
  }
}
