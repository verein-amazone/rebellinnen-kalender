import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, type Observable } from 'rxjs';
import { vi } from 'vitest';

import { AppDataInteractor } from '@app/interactors/settings/app-data.interactor';
import { SheetService } from '@app/view/components/sheet/sheet.service';

import { DevToolsPage } from './dev-tools.page';

class FakeAppDataInteractor {
  calls = 0;

  resetAppData(): Promise<void> {
    this.calls += 1;
    return Promise.resolve();
  }
}

/** Answers sheet opens in the order they are configured; the sheet chrome has its own spec. */
class StubSheetService {
  readonly opens: { heading: string; data: unknown }[] = [];
  results: unknown[] = [];

  open(
    _content: unknown,
    config: { heading: string; data?: unknown },
  ): { closed: Observable<unknown> } {
    this.opens.push({ heading: config.heading, data: config.data });
    return { closed: of(this.results.shift()) };
  }
}

async function setup(confirmations: unknown[] = []) {
  const appData = new FakeAppDataInteractor();
  const sheets = new StubSheetService();
  sheets.results = confirmations;

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AppDataInteractor, useValue: appData },
      { provide: SheetService, useValue: sheets },
    ],
  });

  const fixture = TestBed.createComponent(DevToolsPage);
  await fixture.whenStable();

  const element = fixture.nativeElement as HTMLElement;
  const reload = vi.fn();
  // The page restarts the app after wiping; the window is the one thing a jsdom test cannot let it
  // actually do.
  Object.defineProperty(globalThis.window, 'location', {
    configurable: true,
    value: { ...globalThis.window.location, reload },
  });

  return {
    element,
    appData,
    sheets,
    reload,
    settle: () => fixture.whenStable(),
    reset: () =>
      [...element.querySelectorAll<HTMLButtonElement>('button')]
        .find((button) => button.textContent?.includes('löschen'))!
        .click(),
  };
}

describe('DevToolsPage', () => {
  it('asks before wiping, then clears the data and restarts the app', async () => {
    const { reset, settle, appData, sheets, reload } = await setup([true]);

    reset();
    await settle();

    expect(sheets.opens[0]?.heading).toContain('App-Daten löschen');
    expect(appData.calls).toBe(1);
    expect(reload).toHaveBeenCalled();
  });

  it('does nothing when the confirmation is declined', async () => {
    const { reset, settle, appData, reload } = await setup([false]);

    reset();
    await settle();

    expect(appData.calls).toBe(0);
    expect(reload).not.toHaveBeenCalled();
  });
});
