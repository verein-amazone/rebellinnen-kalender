import { LiveAnnouncer } from '@angular/cdk/a11y';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';
import { describe, expect, it } from 'vitest';

import {
  IcsSubscriptionInteractor,
  type IcsRefreshOutcome,
  type IcsSubscriptionRow,
} from '@app/interactors/calendar/ics-subscription.interactor';
import { SheetService } from '@app/view/components/sheet/sheet.service';
import type { CalendarIdentityEditResult } from '@app/view/dialogs/calendar-identity-edit/calendar-identity-edit.dialog';

import { IcsCalendarsPage } from './ics-calendars.page';

class FakeIcsSubscriptionInteractor {
  rows: IcsSubscriptionRow[] = [];
  readonly updateIdentityCalls: {
    subscriptionId: string;
    identity: CalendarIdentityEditResult;
  }[] = [];
  readonly setEnabledCalls: { subscriptionId: string; enabled: boolean }[] = [];
  readonly refreshCalls: { subscriptionId: string; force?: boolean }[] = [];
  readonly removeCalls: string[] = [];
  refreshOutcome: IcsRefreshOutcome = 'updated';
  pickedEmoji: string | null = '🌻';

  listForManagement(): Promise<IcsSubscriptionRow[]> {
    return Promise.resolve(this.rows);
  }

  updateIdentity(subscriptionId: string, identity: CalendarIdentityEditResult): Promise<void> {
    this.updateIdentityCalls.push({ subscriptionId, identity });
    return Promise.resolve();
  }

  setEnabled(subscriptionId: string, enabled: boolean): Promise<void> {
    this.setEnabledCalls.push({ subscriptionId, enabled });
    return Promise.resolve();
  }

  refresh(subscriptionId: string, options: { force?: boolean } = {}): Promise<IcsRefreshOutcome> {
    this.refreshCalls.push({ subscriptionId, force: options.force });
    return Promise.resolve(this.refreshOutcome);
  }

  remove(subscriptionId: string): Promise<void> {
    this.removeCalls.push(subscriptionId);
    return Promise.resolve();
  }

  pickEmoji(): Promise<string | null> {
    return Promise.resolve(this.pickedEmoji);
  }
}

class StubSheetService {
  results: unknown[] = [];

  open(): { closed: Observable<unknown> } {
    return { closed: of(this.results.shift()) };
  }
}

class StubLiveAnnouncer {
  readonly announcements: string[] = [];

  announce(message: string): Promise<void> {
    this.announcements.push(message);
    return Promise.resolve();
  }
}

async function setup(options: { icsSubscriptions?: IcsSubscriptionRow[] } = {}) {
  const icsSubscriptions = new FakeIcsSubscriptionInteractor();
  if (options.icsSubscriptions !== undefined) {
    icsSubscriptions.rows = options.icsSubscriptions;
  }
  const sheets = new StubSheetService();
  const announcer = new StubLiveAnnouncer();

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: IcsSubscriptionInteractor, useValue: icsSubscriptions },
      { provide: SheetService, useValue: sheets },
      { provide: LiveAnnouncer, useValue: announcer },
    ],
  });

  const fixture = TestBed.createComponent(IcsCalendarsPage);
  await fixture.whenStable();

  return {
    fixture,
    element: fixture.nativeElement as HTMLElement,
    icsSubscriptions,
    sheets,
    announcer,
    settle: () => fixture.whenStable(),
  };
}

function icsRow(overrides: Partial<IcsSubscriptionRow> = {}): IcsSubscriptionRow {
  return {
    id: 'ics-1',
    name: 'Schule',
    color: '#336699',
    emoji: '🏫',
    enabled: true,
    state: 'ok',
    lastError: null,
    ...overrides,
  };
}

describe('IcsCalendarsPage, empty', () => {
  it('explains there are none yet and offers to add one', async () => {
    const { element } = await setup({ icsSubscriptions: [] });

    expect(element.textContent).toContain('Noch keine abonnierten Kalender');
    expect(
      Array.from(element.querySelectorAll('button')).some((b) =>
        b.textContent?.includes('Kalender per Link hinzufügen'),
      ),
    ).toBe(true);
  });
});

describe('IcsCalendarsPage, add', () => {
  it('opens the add sheet and reloads on success', async () => {
    const page = await setup({ icsSubscriptions: [] });
    page.sheets.results = [{ subscriptionId: 'ics-1', outcome: 'updated' }];
    page.icsSubscriptions.rows = [icsRow()];

    const addButton = Array.from(page.element.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Kalender per Link hinzufügen'),
    )!;
    addButton.click();
    await page.settle();

    expect(page.element.textContent).toContain('Schule');
    expect(page.announcer.announcements).toContain('Kalender hinzugefügt');
  });

  it('announces that loading is still pending when the first refresh failed', async () => {
    const page = await setup({ icsSubscriptions: [] });
    page.sheets.results = [{ subscriptionId: 'ics-1', outcome: 'failed' }];

    const addButton = Array.from(page.element.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Kalender per Link hinzufügen'),
    )!;
    addButton.click();
    await page.settle();

    expect(page.announcer.announcements).toContain(
      'Kalender hinzugefügt, konnte aber noch nicht geladen werden',
    );
  });

  it('does nothing when the add sheet is cancelled', async () => {
    const page = await setup({ icsSubscriptions: [] });
    page.sheets.results = [undefined];

    const addButton = Array.from(page.element.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Kalender per Link hinzufügen'),
    )!;
    addButton.click();
    await page.settle();

    expect(page.announcer.announcements).toEqual([]);
  });
});

describe('IcsCalendarsPage, manage', () => {
  it('lists a subscription with a toggle reflecting its enabled state', async () => {
    const { element } = await setup({ icsSubscriptions: [icsRow({ enabled: false })] });

    expect(element.textContent).toContain('Schule');
    const toggle = element.querySelector<HTMLInputElement>('#ics-calendar-ics-1');
    expect(toggle?.checked).toBe(false);
  });

  it('toggles a subscription and reloads', async () => {
    const page = await setup({ icsSubscriptions: [icsRow()] });

    const toggle = page.element.querySelector<HTMLInputElement>('#ics-calendar-ics-1')!;
    toggle.click();
    await page.settle();

    expect(page.icsSubscriptions.setEnabledCalls).toEqual([
      { subscriptionId: 'ics-1', enabled: false },
    ]);
  });

  it('opens the identity editor with the ICS emoji picker and saves the result', async () => {
    const page = await setup({ icsSubscriptions: [icsRow()] });
    const result: CalendarIdentityEditResult = {
      name: 'Vereinstermine',
      color: '#aa3377',
      emoji: '🌸',
    };
    page.sheets.results = [result];

    const editButton = page.element.querySelector<HTMLButtonElement>(
      'button[aria-label*="Schule"][aria-label*="bearbeiten"]',
    )!;
    editButton.click();
    await page.settle();

    expect(page.icsSubscriptions.updateIdentityCalls).toEqual([
      { subscriptionId: 'ics-1', identity: result },
    ]);
    expect(page.announcer.announcements).toContain('Kalender gespeichert');
  });

  it('shows a retry action and error text for a subscription in error state', async () => {
    const page = await setup({
      icsSubscriptions: [icsRow({ state: 'error', lastError: 'Der Server antwortet nicht.' })],
    });

    expect(page.element.textContent).toContain('Der Server antwortet nicht.');
    const retryButton = page.element.querySelector<HTMLButtonElement>(
      'button[aria-label*="Erneut versuchen"][aria-label*="Schule"]',
    );
    expect(retryButton).not.toBeNull();
  });

  it('retries a failing subscription and announces the outcome', async () => {
    const page = await setup({
      icsSubscriptions: [icsRow({ state: 'error', lastError: 'kaputt' })],
    });
    page.icsSubscriptions.refreshOutcome = 'updated';

    const retryButton = page.element.querySelector<HTMLButtonElement>(
      'button[aria-label*="Erneut versuchen"][aria-label*="Schule"]',
    )!;
    retryButton.click();
    await page.settle();

    expect(page.icsSubscriptions.refreshCalls).toEqual([{ subscriptionId: 'ics-1', force: true }]);
    expect(page.announcer.announcements).toContain('Kalender aktualisiert');
  });

  it('shows no retry action for a subscription in ok state', async () => {
    const page = await setup({ icsSubscriptions: [icsRow({ state: 'ok' })] });

    const retryButton = page.element.querySelector<HTMLButtonElement>(
      'button[aria-label*="Erneut versuchen"]',
    );
    expect(retryButton).toBeNull();
  });

  it('removes a subscription after confirmation', async () => {
    const page = await setup({ icsSubscriptions: [icsRow()] });
    page.sheets.results = [true];

    const removeButton = page.element.querySelector<HTMLButtonElement>(
      'button[aria-label*="Schule"][aria-label*="entfernen"]',
    )!;
    removeButton.click();
    await page.settle();

    expect(page.icsSubscriptions.removeCalls).toEqual(['ics-1']);
    expect(page.announcer.announcements).toContain('Kalender entfernt');
  });

  it('does not remove when the confirmation is declined', async () => {
    const page = await setup({ icsSubscriptions: [icsRow()] });
    page.sheets.results = [false];

    const removeButton = page.element.querySelector<HTMLButtonElement>(
      'button[aria-label*="Schule"][aria-label*="entfernen"]',
    )!;
    removeButton.click();
    await page.settle();

    expect(page.icsSubscriptions.removeCalls).toEqual([]);
  });
});
