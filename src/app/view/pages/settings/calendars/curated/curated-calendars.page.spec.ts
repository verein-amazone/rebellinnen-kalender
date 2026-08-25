import { LiveAnnouncer } from '@angular/cdk/a11y';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';
import { describe, expect, it } from 'vitest';

import {
  CuratedCalendarsInteractor,
  type CuratedCalendarRow,
} from '@app/interactors/calendar/curated-calendars.interactor';
import type { IcsRefreshOutcome } from '@app/interactors/calendar/ics-subscription.interactor';
import { SheetService } from '@app/view/components/sheet/sheet.service';
import type { CalendarIdentityEditResult } from '@app/view/dialogs/calendar-identity-edit/calendar-identity-edit.dialog';

import { CuratedCalendarsPage } from './curated-calendars.page';

class FakeCuratedCalendarsInteractor {
  rows: CuratedCalendarRow[] = [];
  readonly updateIdentityCalls: {
    sourceId: string;
    identity: CalendarIdentityEditResult;
  }[] = [];
  readonly setEnabledCalls: { sourceId: string; enabled: boolean }[] = [];
  readonly refreshCalls: { sourceId: string; force?: boolean }[] = [];
  refreshOutcome: IcsRefreshOutcome = 'updated';
  pickedEmoji: string | null = '🇦🇹';

  listForManagement(): Promise<CuratedCalendarRow[]> {
    return Promise.resolve(this.rows);
  }

  updateIdentity(sourceId: string, identity: CalendarIdentityEditResult): Promise<void> {
    this.updateIdentityCalls.push({ sourceId, identity });
    return Promise.resolve();
  }

  setEnabled(sourceId: string, enabled: boolean): Promise<void> {
    this.setEnabledCalls.push({ sourceId, enabled });
    return Promise.resolve();
  }

  refresh(sourceId: string, options: { force?: boolean } = {}): Promise<IcsRefreshOutcome> {
    this.refreshCalls.push({ sourceId, force: options.force });
    return Promise.resolve(this.refreshOutcome);
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

async function setup(options: { rows?: CuratedCalendarRow[] } = {}) {
  const curated = new FakeCuratedCalendarsInteractor();
  if (options.rows !== undefined) {
    curated.rows = options.rows;
  }
  const sheets = new StubSheetService();
  const announcer = new StubLiveAnnouncer();

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: CuratedCalendarsInteractor, useValue: curated },
      { provide: SheetService, useValue: sheets },
      { provide: LiveAnnouncer, useValue: announcer },
    ],
  });

  const fixture = TestBed.createComponent(CuratedCalendarsPage);
  await fixture.whenStable();

  return {
    fixture,
    element: fixture.nativeElement as HTMLElement,
    curated,
    sheets,
    announcer,
    settle: () => fixture.whenStable(),
  };
}

function curatedRow(overrides: Partial<CuratedCalendarRow> = {}): CuratedCalendarRow {
  return {
    id: 'curated-1',
    name: 'Feiertage Österreich',
    description: 'Gesetzliche Feiertage in Österreich.',
    color: '#1565C0',
    emoji: '🇦🇹',
    enabled: true,
    state: 'ok',
    lastError: null,
    ...overrides,
  };
}

describe('CuratedCalendarsPage, empty', () => {
  it('explains there are none available yet', async () => {
    const { element } = await setup({ rows: [] });

    expect(element.textContent).toContain('Derzeit sind keine Kalender verfügbar');
  });
});

describe('CuratedCalendarsPage, manage', () => {
  it('lists a source with its description and a toggle reflecting its enabled state', async () => {
    const { element } = await setup({ rows: [curatedRow({ enabled: false })] });

    expect(element.textContent).toContain('Feiertage Österreich');
    expect(element.textContent).toContain('Gesetzliche Feiertage in Österreich.');
    const toggle = element.querySelector<HTMLInputElement>('#curated-calendar-curated-1');
    expect(toggle?.checked).toBe(false);
  });

  it('toggles a source and reloads', async () => {
    const page = await setup({ rows: [curatedRow()] });

    const toggle = page.element.querySelector<HTMLInputElement>('#curated-calendar-curated-1')!;
    toggle.click();
    await page.settle();

    expect(page.curated.setEnabledCalls).toEqual([{ sourceId: 'curated-1', enabled: false }]);
  });

  it('opens the identity editor with the curated emoji picker and saves the result', async () => {
    const page = await setup({ rows: [curatedRow()] });
    const result: CalendarIdentityEditResult = {
      name: 'Feiertage',
      color: '#000000',
      emoji: '🎉',
    };
    page.sheets.results = [result];

    const editButton = page.element.querySelector<HTMLButtonElement>(
      'button[aria-label*="Feiertage Österreich"][aria-label*="bearbeiten"]',
    )!;
    editButton.click();
    await page.settle();

    expect(page.curated.updateIdentityCalls).toEqual([{ sourceId: 'curated-1', identity: result }]);
    expect(page.announcer.announcements).toContain('Kalender gespeichert');
  });

  it('shows a retry action and error text for a source in error state', async () => {
    const page = await setup({
      rows: [curatedRow({ state: 'error', lastError: 'Der Server antwortet nicht.' })],
    });

    expect(page.element.textContent).toContain('Der Server antwortet nicht.');
    const retryButton = page.element.querySelector<HTMLButtonElement>(
      'button[aria-label*="Erneut versuchen"][aria-label*="Feiertage Österreich"]',
    );
    expect(retryButton).not.toBeNull();
  });

  it('retries a failing source and announces the outcome', async () => {
    const page = await setup({
      rows: [curatedRow({ state: 'error', lastError: 'kaputt' })],
    });
    page.curated.refreshOutcome = 'updated';

    const retryButton = page.element.querySelector<HTMLButtonElement>(
      'button[aria-label*="Erneut versuchen"][aria-label*="Feiertage Österreich"]',
    )!;
    retryButton.click();
    await page.settle();

    expect(page.curated.refreshCalls).toEqual([{ sourceId: 'curated-1', force: true }]);
    expect(page.announcer.announcements).toContain('Kalender aktualisiert');
  });

  it('renders no delete button and no add-by-link control anywhere', async () => {
    const { element } = await setup({ rows: [curatedRow()] });

    expect(element.querySelector('[aria-label*="entfernen"]')).toBeNull();
    expect(
      Array.from(element.querySelectorAll('button')).some((b) =>
        b.textContent?.includes('hinzufügen'),
      ),
    ).toBe(false);
  });
});
