import { InjectionToken, signal, type Type } from '@angular/core';
import { Observable, ReplaySubject } from 'rxjs';

/**
 * How much of the screen the sheet takes.
 *
 * `bottom` hugs its content at the bottom edge, the way a Material bottom sheet does. `full` is a
 * near-full-height sheet for content that needs the room, such as a form.
 */
export type SheetMode = 'bottom' | 'full';

export interface SheetConfig<TData = undefined> {
  /**
   * Rendered as the sheet's heading and referenced by `aria-labelledby`. Required: a modal without
   * an accessible name is announced as an unnamed dialog, which tells the user nothing.
   */
  readonly heading: string;
  /** Defaults to `bottom`. */
  readonly mode?: SheetMode;
  /** Whether Escape, the backdrop and a close button dismiss the sheet. Defaults to `true`. */
  readonly dismissible?: boolean;
  /** Accessible name of the dismiss action. Override where the default is not specific enough. */
  readonly dismissLabel?: string;
  /** Handed to the content component through `SHEET_DATA`. */
  readonly data?: TData;
}

/** `SheetConfig` with the defaults applied, so nothing downstream repeats them. */
export interface ResolvedSheetConfig {
  readonly heading: string;
  readonly mode: SheetMode;
  readonly dismissible: boolean;
  readonly dismissLabel: string;
}

/** The value passed as `SheetConfig.data`. Inject it in the content component. */
export const SHEET_DATA = new InjectionToken<unknown>('SHEET_DATA');

/** @internal Wiring between `SheetService` and the sheet chrome. */
export const SHEET_CONFIG = new InjectionToken<ResolvedSheetConfig>('SHEET_CONFIG');

/** @internal The component the sheet renders in its body. */
export const SHEET_CONTENT = new InjectionToken<Type<unknown>>('SHEET_CONTENT');

/**
 * Handle on one open sheet. `SheetService.open()` returns it to the caller, and the content
 * component injects it to close itself with a result.
 */
export class SheetRef<TResult = undefined> {
  private readonly closedSubject = new ReplaySubject<TResult | undefined>(1);
  private result: TResult | undefined;

  /**
   * Emits exactly once, after the overlay is gone, then completes. The value is whatever was passed
   * to `close()`, or `undefined` when the sheet was dismissed or torn down by a navigation.
   */
  readonly closed: Observable<TResult | undefined> = this.closedSubject.asObservable();

  /** @internal Drives the exit animation; read by the sheet chrome. */
  readonly closing = signal(false);

  constructor(
    private readonly config: ResolvedSheetConfig,
    /** @internal Disposes the overlay. Supplied by `SheetService`. */
    private readonly detach: () => void,
  ) {}

  /** Close with a result. Runs the exit animation first; `closed` emits once the sheet is gone. */
  close(result?: TResult): void {
    if (this.closing()) {
      return;
    }

    this.result = result;
    this.closing.set(true);
  }

  /** Close without a result. Does nothing when the sheet was opened as non-dismissible. */
  dismiss(): void {
    if (this.config.dismissible) {
      this.close();
    }
  }

  /** @internal Called by the chrome once the exit animation has finished. */
  finish(): void {
    this.detach();
  }

  /** @internal Called by `SheetService` once the overlay has been torn down. */
  settle(): void {
    this.closedSubject.next(this.result);
    this.closedSubject.complete();
  }
}
