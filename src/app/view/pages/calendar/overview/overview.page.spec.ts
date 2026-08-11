import { LOCALE_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LocalDay } from '@app/cross-cutting/infrastructure/local-day';
import { CalendarOccurrencesInteractor } from '@app/interactors/calendar/calendar-occurrences.interactor';
import type { CalendarOccurrence } from '@app/interactors/calendar/calendar-occurrence.vm';
import { DeviceCalendarSyncInteractor } from '@app/interactors/calendar/device-calendar-sync.interactor';

import { CalendarOverviewPage } from './overview.page';

function occurrence(overrides: Partial<CalendarOccurrence> = {}): CalendarOccurrence {
  return {
    id: 'occ-1',
    sourceId: 'source-1',
    calendarId: 'calendar-1',
    seriesId: null,
    originalStart: null,
    itemId: null,
    externalId: null,
    kind: 'event',
    title: 'Workshop',
    location: null,
    description: null,
    allDay: false,
    start: { kind: 'zoned', value: '2026-08-05T09:30:00', timeZone: 'Europe/Vienna' },
    end: { kind: 'zoned', value: '2026-08-05T11:00:00', timeZone: 'Europe/Vienna' },
    startUtc: '2026-08-05T07:30:00Z',
    endUtc: '2026-08-05T09:00:00Z',
    startDay: '2026-08-05',
    endDay: '2026-08-05',
    actions: { editableInApp: true, deletableInApp: true, editViaNativeCalendar: false },
    stale: false,
    sourceName: 'Meine Kalender',
    calendarName: 'Mein Kalender',
    calendarColor: '#7b3fa8',
    calendarEmoji: '📅',
    ...overrides,
  };
}

class FakeCalendarOccurrencesInteractor {
  items: CalendarOccurrence[] = [];
  readonly calls: { fromDay: string; toDay: string }[] = [];

  listForDays(fromDay: string, toDay: string): Promise<CalendarOccurrence[]> {
    this.calls.push({ fromDay, toDay });
    return Promise.resolve(this.items);
  }
}

class StubLocalDay {
  readonly day = signal('2026-08-07');
}

class FakeDeviceCalendarSyncInteractor {
  refreshCalls = 0;

  refresh(): Promise<void> {
    this.refreshCalls += 1;
    return Promise.resolve();
  }
}

interface Setup {
  readonly element: HTMLElement;
  readonly interactor: FakeCalendarOccurrencesInteractor;
  readonly navigate: ReturnType<typeof vi.fn>;
  readonly setInputs: (inputs: { view?: string; day?: string }) => Promise<void>;
}

async function setup(
  inputs: { view?: string; day?: string } = {},
  items: CalendarOccurrence[] = [],
): Promise<Setup> {
  const interactor = new FakeCalendarOccurrencesInteractor();
  interactor.items = items;

  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: LOCALE_ID, useValue: 'de' },
      { provide: CalendarOccurrencesInteractor, useValue: interactor },
      { provide: DeviceCalendarSyncInteractor, useClass: FakeDeviceCalendarSyncInteractor },
      { provide: LocalDay, useClass: StubLocalDay },
    ],
  });

  const navigate = vi.fn().mockResolvedValue(true);
  TestBed.inject(Router).navigate = navigate;

  const fixture = TestBed.createComponent(CalendarOverviewPage);
  fixture.componentRef.setInput('view', inputs.view);
  fixture.componentRef.setInput('day', inputs.day);
  await fixture.whenStable();

  return {
    element: fixture.nativeElement as HTMLElement,
    interactor,
    navigate,
    setInputs: async (next) => {
      fixture.componentRef.setInput('view', next.view);
      fixture.componentRef.setInput('day', next.day);
      await fixture.whenStable();
    },
  };
}

function queryParamsOf(navigate: ReturnType<typeof vi.fn>, call = 0): Record<string, string> {
  const options = navigate.mock.calls[call][1] as {
    queryParams: Record<string, string>;
    queryParamsHandling: string;
    replaceUrl: boolean;
  };
  expect(options.queryParamsHandling).toBe('merge');
  expect(options.replaceUrl).toBe(true);
  return options.queryParams;
}

describe('CalendarOverviewPage', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('defaults to the week view around today', async () => {
    const { element, interactor } = await setup();

    // 2026-08-07 is a Friday; its week runs 3 through 9 August.
    expect(interactor.calls).toEqual([{ fromDay: '2026-08-03', toDay: '2026-08-09' }]);
    expect(element.textContent).toContain('3.–9. August 2026');
    expect(element.querySelectorAll('h1')).toHaveLength(1);
  });

  it('loads the full grid range in month view', async () => {
    const { interactor, element } = await setup({ view: 'month', day: '2026-08-15' });

    expect(interactor.calls).toEqual([{ fromDay: '2026-07-27', toDay: '2026-09-06' }]);
    expect(element.textContent).toContain('August 2026');
  });

  it('falls back to today when the day parameter is not a date', async () => {
    const { interactor } = await setup({ day: 'nonsense' });

    expect(interactor.calls).toEqual([{ fromDay: '2026-08-03', toDay: '2026-08-09' }]);
  });

  it('does not reload when the selected day stays inside the loaded range', async () => {
    const { interactor, setInputs } = await setup({ day: '2026-08-05' });

    await setInputs({ day: '2026-08-06' });

    expect(interactor.calls).toHaveLength(1);
  });

  it('navigates a week back and forward from the arrow buttons', async () => {
    const { element, navigate } = await setup({ day: '2026-08-05' });

    element.querySelector<HTMLButtonElement>('button[aria-label="Vorherige Woche"]')?.click();
    element.querySelector<HTMLButtonElement>('button[aria-label="Nächste Woche"]')?.click();

    expect(queryParamsOf(navigate, 0)).toEqual({ day: '2026-07-29' });
    expect(queryParamsOf(navigate, 1)).toEqual({ day: '2026-08-12' });
  });

  it('navigates a month back and forward in month view', async () => {
    const { element, navigate } = await setup({ view: 'month', day: '2026-08-31' });

    element.querySelector<HTMLButtonElement>('button[aria-label="Vorheriger Monat"]')?.click();
    element.querySelector<HTMLButtonElement>('button[aria-label="Nächster Monat"]')?.click();

    expect(queryParamsOf(navigate, 0)).toEqual({ day: '2026-07-31' });
    expect(queryParamsOf(navigate, 1)).toEqual({ day: '2026-09-30' });
  });

  it('returns to and selects today from „Heute"', async () => {
    const { element, navigate } = await setup({ view: 'month', day: '2026-11-15' });

    const today = Array.from(element.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Heute'),
    );
    today?.click();

    expect(queryParamsOf(navigate)).toEqual({ view: 'month', day: '2026-08-07' });
  });

  it('switches the view while keeping the selected day', async () => {
    const { element, navigate } = await setup({ day: '2026-08-05' });

    const monthRadio = element.querySelector<HTMLInputElement>('input[value="month"]');
    monthRadio?.click();

    expect(queryParamsOf(navigate)).toEqual({ view: 'month', day: '2026-08-05' });
  });

  it('offers week and month as a labelled radio choice', async () => {
    const { element } = await setup();

    const radios = element.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    expect(radios).toHaveLength(2);
    expect(element.querySelector('fieldset legend')?.textContent).toContain('Ansicht');
    expect(element.querySelector<HTMLInputElement>('input[value="week"]')?.checked).toBe(true);
  });

  it('selecting a day in the grid navigates to it', async () => {
    const { element, navigate } = await setup({ day: '2026-08-05' });

    // The grid's first cell is Monday the 3rd.
    const cells = Array.from(element.querySelectorAll<HTMLButtonElement>('button[aria-pressed]'));
    cells[0]?.click();

    expect(queryParamsOf(navigate)).toEqual({ day: '2026-08-03' });
  });

  it('feeds the selected day and loaded occurrences to the agenda', async () => {
    const { element } = await setup({ day: '2026-08-05' }, [occurrence()]);

    expect(element.textContent).toContain('Workshop');
    expect(element.textContent).toContain('Mittwoch, 5. August 2026');
  });
});
