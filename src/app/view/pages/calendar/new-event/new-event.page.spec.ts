import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import {
  AppCalendarsInteractor,
  type WritableAppCalendar,
} from '@app/interactors/calendar/app-calendars.interactor';
import {
  AppEventEditingInteractor,
  type AppEventDraft,
} from '@app/interactors/calendar/app-event-editing.interactor';
import { SheetService } from '@app/view/components/sheet/sheet.service';

import { NewEventPage } from './new-event.page';

const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const calendarPrivate: WritableAppCalendar = {
  id: 'cal-privat',
  name: 'Privat',
  color: '#a1b2c3',
  emoji: '🏠',
};

class FakeAppCalendarsInteractor {
  listWritable(): Promise<WritableAppCalendar[]> {
    return Promise.resolve([calendarPrivate]);
  }
}

class FakeAppEventEditingInteractor {
  readonly createCalls: AppEventDraft[] = [];
  nextId = 'new-item-1';

  create(draft: AppEventDraft): Promise<string> {
    this.createCalls.push(draft);
    return Promise.resolve(this.nextId);
  }
}

/** Answers the next sheet open with the given result, without ever attaching a real overlay. */
class StubSheetService {
  results: unknown[] = [];
  opens: { heading: string; data: unknown }[] = [];

  open(
    _content: unknown,
    config: { heading: string; data?: unknown },
  ): { closed: Observable<unknown> } {
    this.opens.push({ heading: config.heading, data: config.data });
    return { closed: of(this.results.shift()) };
  }
}

async function setup(day?: string) {
  const eventEditing = new FakeAppEventEditingInteractor();
  const sheets = new StubSheetService();

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AppCalendarsInteractor, useValue: new FakeAppCalendarsInteractor() },
      { provide: AppEventEditingInteractor, useValue: eventEditing },
      { provide: SheetService, useValue: sheets },
    ],
  });

  const navigate = vi.fn().mockResolvedValue(true);
  const navigateByUrl = vi.fn().mockResolvedValue(true);
  const router = TestBed.inject(Router);
  router.navigate = navigate;
  router.navigateByUrl = navigateByUrl;

  const locationBack = vi.fn();
  TestBed.inject(Location).back = locationBack;

  const fixture = TestBed.createComponent(NewEventPage);
  if (day !== undefined) {
    fixture.componentRef.setInput('day', day);
  }
  await fixture.whenStable();

  const element = fixture.nativeElement as HTMLElement;

  return {
    fixture,
    element,
    eventEditing,
    sheets,
    navigate,
    navigateByUrl,
    locationBack,
    router,
    settle: () => fixture.whenStable(),
    field(id: string): HTMLInputElement | HTMLTextAreaElement {
      return element.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`)!;
    },
    async type(id: string, value: string) {
      const control = this.field(id);
      control.value = value;
      control.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    },
    /** Expands the collapsed Starts/Ends/Ganztägig section, so its fields exist in the DOM. */
    async expandDateTime() {
      element.querySelector<HTMLButtonElement>('#event-form-date-time button')!.click();
      await fixture.whenStable();
    },
    async pickCalendar(calendarId: string) {
      sheets.results = [calendarId];
      element.querySelector<HTMLButtonElement>('#event-form-calendar')!.click();
      await fixture.whenStable();
    },
    async pickAllDay(allDay: boolean) {
      const toggle = element.querySelector<HTMLInputElement>('#event-form-date-time .rk-toggle')!;
      if (toggle.checked !== allDay) {
        toggle.click();
        await fixture.whenStable();
      }
    },
    async submit() {
      element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      await fixture.whenStable();
    },
    /**
     * There is no cancel button of this page's own any more — cancelling is entirely the scaffold's
     * own `dismissal="close"` (X) affordance, whose accessible name is the visually hidden
     * "Schließen" span.
     */
    async clickCancel() {
      const button = Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(
        (candidate) => candidate.textContent?.includes('Schließen'),
      );
      button!.click();
      await fixture.whenStable();
    },
  };
}

describe('NewEventPage, rendering', () => {
  it('renders the event form in create mode inside the focused screen', async () => {
    const { element } = await setup();

    expect(element.textContent).toContain('Neuer Termin');
    expect(element.querySelector('app-event-form')).toBeTruthy();
  });

  it('prefills the date field from the day query param', async () => {
    const page = await setup('2026-08-05');
    await page.expandDateTime();

    expect(page.field('event-form-date-time-start-date').value).toBe('2026-08-05');
  });

  it('leaves the date field blank when there is no day query param', async () => {
    const page = await setup();
    await page.expandDateTime();

    expect(page.field('event-form-date-time-start-date').value).toBe('');
  });
});

describe('NewEventPage, create', () => {
  it('creates an all-day appointment and navigates to its day', async () => {
    const page = await setup();
    await page.expandDateTime();

    await page.type('event-form-title', 'Geburtstag');
    await page.pickAllDay(true);
    await page.type('event-form-date-time-start-date', '2026-09-01');
    await page.type('event-form-date-time-end-date', '2026-09-01');
    await page.submit();

    const { eventEditing, navigate } = page;
    expect(eventEditing.createCalls).toHaveLength(1);
    expect(eventEditing.createCalls[0]).toEqual({
      calendarId: 'cal-privat',
      kind: 'event',
      title: 'Geburtstag',
      location: null,
      note: null,
      start: { kind: 'date', value: '2026-09-01', timeZone: null },
      end: { kind: 'date', value: '2026-09-02', timeZone: null },
      rrule: null,
    });
    expect(navigate).toHaveBeenCalledWith(['/calendar'], {
      queryParams: { day: '2026-09-01' },
      replaceUrl: true,
    });
  });

  it('creates a timed appointment and navigates to the day the user picked', async () => {
    const page = await setup();
    await page.expandDateTime();

    await page.type('event-form-title', 'Vereinstreffen');
    await page.type('event-form-date-time-start-date', '2026-09-02');
    await page.type('event-form-date-time-start-time', '18:00');
    await page.type('event-form-date-time-end-date', '2026-09-02');
    await page.type('event-form-date-time-end-time', '19:30');
    await page.type('event-form-location', 'Gemeindesaal');
    await page.submit();

    const { eventEditing, navigate } = page;
    expect(eventEditing.createCalls).toHaveLength(1);
    expect(eventEditing.createCalls[0]).toEqual({
      calendarId: 'cal-privat',
      kind: 'event',
      title: 'Vereinstreffen',
      location: 'Gemeindesaal',
      note: null,
      start: { kind: 'zoned', value: '2026-09-02T18:00:00', timeZone: deviceZone },
      end: { kind: 'zoned', value: '2026-09-02T19:30:00', timeZone: deviceZone },
      rrule: null,
    });
    expect(navigate).toHaveBeenCalledWith(['/calendar'], {
      queryParams: { day: '2026-09-02' },
      replaceUrl: true,
    });
  });

  it('does not create anything and does not navigate while the title is empty', async () => {
    const page = await setup();
    await page.expandDateTime();

    await page.type('event-form-date-time-start-date', '2026-09-01');
    await page.type('event-form-date-time-start-time', '08:00');
    await page.type('event-form-date-time-end-date', '2026-09-01');
    await page.type('event-form-date-time-end-time', '09:00');
    await page.submit();

    expect(page.eventEditing.createCalls).toEqual([]);
    expect(page.navigate).not.toHaveBeenCalled();
    expect(page.element.querySelector('.rk-error')).not.toBeNull();
  });
});

describe('NewEventPage, cancel', () => {
  it('discards the entered data and returns to the calendar', async () => {
    const page = await setup();

    await page.type('event-form-title', 'Halb ausgefüllt');
    await page.clickCancel();

    expect(page.eventEditing.createCalls).toEqual([]);
    expect(page.navigateByUrl).toHaveBeenCalledWith('/calendar', { replaceUrl: true });
  });

  it('leaves the browser history alone even when there is in-app history to walk back', async () => {
    const page = await setup();
    // `lastSuccessfulNavigation` is a getter returning a signal, not a plain method — and not one of
    // the properties `vi.spyOn`'s typings recognise as a get accessor on `Router`, so it is stubbed
    // directly instead. The scaffold used to prefer `location.back()` in exactly this situation,
    // which is what let the abandoned form stay in the history and be walked back into.
    Object.defineProperty(page.router, 'lastSuccessfulNavigation', {
      configurable: true,
      get: () => () => ({ previousNavigation: {} }),
    });

    await page.type('event-form-title', 'Halb ausgefüllt');
    await page.clickCancel();

    expect(page.eventEditing.createCalls).toEqual([]);
    expect(page.locationBack).not.toHaveBeenCalled();
    expect(page.navigateByUrl).toHaveBeenCalledWith('/calendar', { replaceUrl: true });
  });
});
