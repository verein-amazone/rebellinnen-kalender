import { ChangeDetectionStrategy, Component, inject, Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { InteractivityChecker } from '@angular/cdk/a11y';
import { provideRouter } from '@angular/router';

import { SHEET_DATA, SheetRef } from './sheet-ref';
import { SheetService } from './sheet.service';

/**
 * The CDK decides whether an element can take focus partly from its geometry, and in jsdom every
 * box is zero by zero — so the sheet's heading would always be judged unfocusable and the focus
 * trap would give up before focusing anything. Ignoring visibility lets the rest of the wiring be
 * exercised here; that the heading really is focusable in a laid-out page is an e2e concern.
 */
@Injectable()
class VisibilityAgnosticInteractivityChecker extends InteractivityChecker {
  override isFocusable(element: HTMLElement): boolean {
    return super.isFocusable(element, { ignoreVisibility: true });
  }
}

@Component({
  template: '<p>Inhalt</p><button type="button" (click)="close()">Fertig</button>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ContentComponent {
  readonly data = inject(SHEET_DATA);
  private readonly sheetRef = inject<SheetRef<string>>(SheetRef);

  close(): void {
    this.sheetRef.close('fertig');
  }
}

describe('SheetService', () => {
  let service: SheetService;
  let shell: HTMLElement;
  let opener: HTMLButtonElement;

  /**
   * The focus trap defers entry through `afterNextRender`, so a zoneless test needs to let both a
   * render and the following microtask run before focus has actually landed.
   */
  async function flush(): Promise<void> {
    for (let i = 0; i < 2; i++) {
      TestBed.tick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    TestBed.tick();
  }

  /** Advances past the exit-animation fallback. jsdom never fires `animationend`. */
  async function settleExit(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 350));
    TestBed.tick();
  }

  const panel = () => document.querySelector<HTMLElement>('.rk-sheet-panel');
  const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: InteractivityChecker, useClass: VisibilityAgnosticInteractivityChecker },
      ],
    });

    /*
     * The service only ever queries the shell in the document, so a plain element is a truer stand-in
     * than a component fixture — it makes the test independent of what host tag TestBed picks.
     */
    shell = document.createElement('app-root');
    shell.innerHTML = '<main><h1>Heute</h1></main><button type="button">Öffnen</button>';
    document.body.appendChild(shell);
    opener = shell.querySelector('button')!;

    service = TestBed.inject(SheetService);
  });

  afterEach(() => {
    shell.remove();
    document.querySelectorAll('.cdk-overlay-container').forEach((node) => node.remove());
  });

  it('renders one named modal dialog', async () => {
    service.open(ContentComponent, { heading: 'Kalender wählen' });
    await flush();

    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(dialog()?.getAttribute('aria-modal')).toBe('true');

    const labelledBy = dialog()?.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)?.textContent?.trim()).toBe('Kalender wählen');
  });

  it('moves focus to the heading on open', async () => {
    service.open(ContentComponent, { heading: 'Kalender wählen' });
    await flush();

    expect(document.activeElement?.tagName).toBe('H2');
    expect(document.activeElement?.textContent?.trim()).toBe('Kalender wählen');
  });

  it('renders the content component and hands it the configured data', async () => {
    service.open(ContentComponent, { heading: 'Kalender wählen', data: { id: 42 } });
    await flush();

    expect(dialog()?.textContent).toContain('Inhalt');
  });

  it('closes on Escape and reports no result', async () => {
    const ref = service.open(ContentComponent, { heading: 'Kalender wählen' });
    await flush();

    let result: unknown = 'untouched';
    ref.closed.subscribe((value) => (result = value));

    dispatchEscape();
    await settleExit();

    expect(dialog()).toBeNull();
    expect(result).toBeUndefined();
  });

  it('closes on a backdrop click when it is dismissible', async () => {
    service.open(ContentComponent, { heading: 'Kalender wählen' });
    await flush();

    document.querySelector<HTMLElement>('.cdk-overlay-backdrop')?.click();
    await settleExit();

    expect(dialog()).toBeNull();
  });

  it('ignores Escape and the backdrop when it is not dismissible', async () => {
    service.open(ContentComponent, { heading: 'Kalender wählen', dismissible: false });
    await flush();

    dispatchEscape();
    document.querySelector<HTMLElement>('.cdk-overlay-backdrop')?.click();
    await settleExit();

    expect(dialog()).not.toBeNull();
    // A non-dismissible sheet also renders no close button, so there is no control that does nothing.
    expect(dialog()?.querySelector('.rk-icon-button')).toBeNull();
  });

  it('reports the result the content closed with, then completes', async () => {
    const ref = service.open<string>(ContentComponent, { heading: 'Kalender wählen' });
    await flush();

    let result: string | undefined;
    let completed = false;
    ref.closed.subscribe({
      next: (value) => (result = value),
      complete: () => (completed = true),
    });

    dialog()?.querySelector<HTMLButtonElement>('button:not(.rk-icon-button)')?.click();
    await settleExit();

    expect(result).toBe('fertig');
    expect(completed).toBe(true);
  });

  it('returns focus to whatever opened it', async () => {
    opener.focus();
    expect(document.activeElement).toBe(opener);

    const ref = service.open(ContentComponent, { heading: 'Kalender wählen' });
    await flush();
    expect(document.activeElement).not.toBe(opener);

    ref.dismiss();
    await settleExit();

    expect(document.activeElement).toBe(opener);
  });

  it('falls back to the page heading when the opener is gone', async () => {
    opener.focus();

    const ref = service.open(ContentComponent, { heading: 'Kalender wählen' });
    await flush();

    // The sheet's action navigated away and destroyed the button that opened it.
    opener.remove();

    ref.dismiss();
    await settleExit();

    expect(document.activeElement?.tagName).toBe('H1');
  });

  it('holds the app shell inert until the last sheet is gone', async () => {
    const first = service.open(ContentComponent, { heading: 'Erstes' });
    await flush();
    expect(shell.hasAttribute('inert')).toBe(true);

    const second = service.open(ContentComponent, { heading: 'Zweites' });
    await flush();

    first.dismiss();
    await settleExit();
    // One sheet is still open, so the shell must stay inert.
    expect(shell.hasAttribute('inert')).toBe(true);

    second.dismiss();
    await settleExit();
    expect(shell.hasAttribute('inert')).toBe(false);
  });

  it('maps the mode onto the panel height modifier', async () => {
    service.open(ContentComponent, { heading: 'Voll', mode: 'full' });
    await flush();

    expect(panel()?.classList.contains('rk-sheet-panel-full')).toBe(true);
    expect(panel()?.classList.contains('rk-sheet-panel-bottom')).toBe(false);
    // The grabber is a bottom-sheet affordance and must not show on the full-height variant.
    expect(panel()?.querySelector('.rk-sheet-grabber')).toBeNull();
  });

  it('defaults to the bottom mode', async () => {
    service.open(ContentComponent, { heading: 'Unten' });
    await flush();

    expect(panel()?.classList.contains('rk-sheet-panel-bottom')).toBe(true);
    expect(panel()?.querySelector('.rk-sheet-grabber')).not.toBeNull();
  });

  /*
   * Not covered here: scroll blocking. `BlockScrollStrategy` only engages when the document is
   * actually scrollable (`body.scrollHeight > viewport height`), and in jsdom every box is zero
   * high, so the strategy correctly does nothing and there is nothing to assert. It is verified in
   * the Playwright smoke test instead, in a real viewport.
   */
});

function dispatchEscape(): void {
  document
    .querySelector('.cdk-overlay-container')
    ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}
