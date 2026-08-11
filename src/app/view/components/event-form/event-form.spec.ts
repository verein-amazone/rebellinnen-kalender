import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';

import {
  APP_EVENT_TITLE_MAX_LENGTH,
  type AppEventChanges,
  type AppEventDraft,
} from '@app/interactors/calendar/app-event-editing.interactor';
import {
  AppCalendarsInteractor,
  type WritableAppCalendar,
} from '@app/interactors/calendar/app-calendars.interactor';
import type { CalendarOccurrence } from '@app/interactors/calendar/calendar-occurrence.vm';
import { SheetService } from '@app/view/components/sheet/sheet.service';

import { EventForm, type AppEventFormResult } from './event-form';

const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const calendarPrivate: WritableAppCalendar = {
  id: 'cal-privat',
  name: 'Privat',
  color: '#a1b2c3',
  emoji: '🏠',
};
const calendarVerein: WritableAppCalendar = {
  id: 'cal-verein',
  name: 'Verein',
  color: '#c3b2a1',
  emoji: null,
};

class FakeAppCalendarsInteractor {
  calendars: WritableAppCalendar[] = [calendarPrivate, calendarVerein];

  listWritable(): Promise<WritableAppCalendar[]> {
    return Promise.resolve(this.calendars);
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

function timedOccurrence(overrides: Partial<CalendarOccurrence> = {}): CalendarOccurrence {
  return {
    id: 'occ-1',
    sourceId: 'source-app',
    calendarId: 'cal-privat',
    seriesId: null,
    originalStart: null,
    itemId: 'item-1',
    externalId: null,
    kind: 'event',
    title: 'Zahnarzt',
    location: 'Praxis Dr. Muster',
    description: null,
    allDay: false,
    start: { kind: 'zoned', value: '2026-08-10T09:00:00', timeZone: deviceZone },
    end: { kind: 'zoned', value: '2026-08-10T10:30:00', timeZone: deviceZone },
    startUtc: '2026-08-10T09:00:00Z',
    endUtc: '2026-08-10T10:30:00Z',
    startDay: '2026-08-10',
    endDay: '2026-08-10',
    actions: { editableInApp: true, deletableInApp: true, editViaNativeCalendar: false },
    stale: false,
    sourceName: 'Meine Termine',
    calendarName: 'Privat',
    calendarColor: '#a1b2c3',
    calendarEmoji: '🏠',
    ...overrides,
  };
}

async function setup(inputs: {
  mode: 'create' | 'edit';
  initialOccurrence?: CalendarOccurrence | null;
  initialNote?: string | null;
  initialDate?: string | null;
  calendars?: WritableAppCalendar[];
}) {
  const interactor = new FakeAppCalendarsInteractor();
  if (inputs.calendars !== undefined) {
    interactor.calendars = inputs.calendars;
  }
  const sheets = new StubSheetService();

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: AppCalendarsInteractor, useValue: interactor },
      { provide: SheetService, useValue: sheets },
    ],
  });

  const fixture = TestBed.createComponent(EventForm);
  fixture.componentRef.setInput('mode', inputs.mode);
  if (inputs.initialOccurrence !== undefined) {
    fixture.componentRef.setInput('initialOccurrence', inputs.initialOccurrence);
  }
  if (inputs.initialNote !== undefined) {
    fixture.componentRef.setInput('initialNote', inputs.initialNote);
  }
  if (inputs.initialDate !== undefined) {
    fixture.componentRef.setInput('initialDate', inputs.initialDate);
  }
  await fixture.whenStable();

  const element = fixture.nativeElement as HTMLElement;
  const saved: AppEventFormResult[] = [];
  fixture.componentInstance.save.subscribe((result) => saved.push(result));

  return {
    fixture,
    element,
    interactor,
    sheets,
    saved,
    settle: () => fixture.whenStable(),
    // Plain `#id` is safe here: `app-text-field`/`app-textarea-field` suppress reflecting their
    // `id` @Input onto the host element (`[attr.id]: null` in each component's `host` object), so
    // only the inner `<input>`/`<textarea>` carries the id — no duplicate for `querySelector` to
    // trip over.
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
  };
}

describe('EventForm, create mode', () => {
  it('defaults the calendar picker to the first writable calendar, and leaves the title blank', async () => {
    const form = await setup({ mode: 'create' });

    expect(form.element.querySelector('#event-form-calendar')?.textContent).toContain('Privat');

    const title = form.element.querySelector<HTMLInputElement>('input[type="text"]');
    expect(title?.value).toBe('');
  });

  it('prefills the date from initialDate, e.g. the day the user was viewing', async () => {
    const form = await setup({ mode: 'create', initialDate: '2026-08-05' });
    await form.expandDateTime();

    expect(form.field('event-form-date-time-start-date').value).toBe('2026-08-05');
  });

  it('emits a completed draft, with kind "event" and no recurrence, on save', async () => {
    const form = await setup({ mode: 'create' });
    await form.expandDateTime();

    await form.pickCalendar('cal-verein');
    await form.type('event-form-title', 'Vereinstreffen');
    await form.type('event-form-date-time-start-date', '2026-09-01');
    await form.type('event-form-date-time-start-time', '18:00');
    await form.type('event-form-date-time-end-date', '2026-09-01');
    await form.type('event-form-date-time-end-time', '19:30');
    await form.type('event-form-location', 'Gemeindesaal');
    await form.type('event-form-note', 'Bitte Stühle mitbringen');
    await form.submit();

    expect(form.saved).toHaveLength(1);
    const result = form.saved[0];
    expect(result.mode).toBe('create');
    const draft = (result as { mode: 'create'; draft: AppEventDraft }).draft;
    expect(draft).toEqual({
      calendarId: 'cal-verein',
      kind: 'event',
      title: 'Vereinstreffen',
      location: 'Gemeindesaal',
      note: 'Bitte Stühle mitbringen',
      start: { kind: 'zoned', value: '2026-09-01T18:00:00', timeZone: deviceZone },
      end: { kind: 'zoned', value: '2026-09-01T19:30:00', timeZone: deviceZone },
      rrule: null,
    });
  });

  it('builds an all-day draft as date-only temporal values spanning one day', async () => {
    const form = await setup({ mode: 'create' });
    await form.expandDateTime();

    await form.pickCalendar('cal-privat');
    await form.type('event-form-title', 'Geburtstag');
    await form.pickAllDay(true);
    await form.type('event-form-date-time-start-date', '2026-09-01');
    await form.type('event-form-date-time-end-date', '2026-09-01');
    await form.submit();

    expect(form.saved).toHaveLength(1);
    const draft = (form.saved[0] as { mode: 'create'; draft: AppEventDraft }).draft;
    expect(draft.start).toEqual({ kind: 'date', value: '2026-09-01', timeZone: null });
    expect(draft.end).toEqual({ kind: 'date', value: '2026-09-02', timeZone: null });
  });

  it('builds a multi-day all-day draft, storing the exclusive day after the chosen end date', async () => {
    const form = await setup({ mode: 'create' });
    await form.expandDateTime();

    await form.pickCalendar('cal-privat');
    await form.type('event-form-title', 'Zeltlager');
    await form.pickAllDay(true);
    await form.type('event-form-date-time-start-date', '2026-09-01');
    await form.type('event-form-date-time-end-date', '2026-09-03');
    await form.submit();

    expect(form.saved).toHaveLength(1);
    const draft = (form.saved[0] as { mode: 'create'; draft: AppEventDraft }).draft;
    expect(draft.start).toEqual({ kind: 'date', value: '2026-09-01', timeZone: null });
    expect(draft.end).toEqual({ kind: 'date', value: '2026-09-04', timeZone: null });
  });

  it('blocks save when the all-day end date is before the start date', async () => {
    const form = await setup({ mode: 'create' });
    await form.expandDateTime();

    await form.pickCalendar('cal-privat');
    await form.type('event-form-title', 'Verkehrter Zeitraum');
    await form.pickAllDay(true);
    await form.type('event-form-date-time-start-date', '2026-09-05');
    await form.type('event-form-date-time-end-date', '2026-09-01');
    await form.submit();

    expect(form.saved).toEqual([]);
    expect(form.element.querySelector('.rk-error')?.textContent).toContain(
      'Enddatum darf nicht vor dem Startdatum liegen',
    );
  });

  it('turns blank location and note into null, never empty strings', async () => {
    const form = await setup({ mode: 'create' });
    await form.expandDateTime();

    await form.pickCalendar('cal-privat');
    await form.type('event-form-title', 'Ohne Details');
    await form.type('event-form-date-time-start-date', '2026-09-01');
    await form.type('event-form-date-time-start-time', '08:00');
    await form.type('event-form-date-time-end-date', '2026-09-01');
    await form.type('event-form-date-time-end-time', '09:00');
    await form.submit();

    const draft = (form.saved[0] as { mode: 'create'; draft: AppEventDraft }).draft;
    expect(draft.location).toBeNull();
    expect(draft.note).toBeNull();
  });
});

describe('EventForm, no writable calendars', () => {
  it('shows an empty-state message instead of an empty picker', async () => {
    const form = await setup({ mode: 'create', calendars: [] });

    expect(form.element.querySelector('#event-form-calendar')).toBeNull();
    expect(form.element.textContent).toContain('Es ist noch kein Kalender vorhanden');
  });
});

describe('EventForm, edit mode', () => {
  it('pre-fills every field from the initial occurrence and the given note', async () => {
    const form = await setup({
      mode: 'edit',
      initialOccurrence: timedOccurrence(),
      initialNote: 'Zahnreinigung nicht vergessen',
    });
    await form.expandDateTime();

    expect(form.field('event-form-title').value).toBe('Zahnarzt');
    expect(form.field('event-form-location').value).toBe('Praxis Dr. Muster');
    expect(form.field('event-form-note').value).toBe('Zahnreinigung nicht vergessen');
    expect(form.field('event-form-date-time-start-date').value).toBe('2026-08-10');
    expect(form.field('event-form-date-time-start-time').value).toBe('09:00');
    expect(form.field('event-form-date-time-end-date').value).toBe('2026-08-10');
    expect(form.field('event-form-date-time-end-time').value).toBe('10:30');
    expect(form.element.querySelector('#event-form-calendar')?.textContent).toContain('Privat');
  });

  it('disables the calendar picker, since moving an app item between calendars is not supported', async () => {
    const form = await setup({ mode: 'edit', initialOccurrence: timedOccurrence() });

    const button = form.element.querySelector<HTMLButtonElement>('#event-form-calendar')!;
    expect(button.disabled).toBe(true);
  });

  it('emits changes without a calendarId, since the interactor cannot move an item between calendars', async () => {
    const form = await setup({
      mode: 'edit',
      initialOccurrence: timedOccurrence(),
      initialNote: '',
    });

    await form.type('event-form-title', 'Zahnarzt (verschoben)');
    await form.submit();

    expect(form.saved).toHaveLength(1);
    const result = form.saved[0];
    expect(result.mode).toBe('edit');
    const changes = (result as { mode: 'edit'; changes: AppEventChanges }).changes;
    expect(changes).not.toHaveProperty('calendarId');
    expect(changes).toEqual({
      title: 'Zahnarzt (verschoben)',
      location: 'Praxis Dr. Muster',
      note: null,
      start: { kind: 'zoned', value: '2026-08-10T09:00:00', timeZone: deviceZone },
      end: { kind: 'zoned', value: '2026-08-10T10:30:00', timeZone: deviceZone },
    });
  });

  it("preserves an overnight occurrence's end date across a save that never touches the time fields", async () => {
    // 22:00 one day through 02:00 the next — the form has no field for the end date, so this is the
    // case that used to be silently rewritten to end before it starts (#19 final review, finding 4).
    const overnight = timedOccurrence({
      start: { kind: 'zoned', value: '2026-08-10T22:00:00', timeZone: deviceZone },
      end: { kind: 'zoned', value: '2026-08-11T02:00:00', timeZone: deviceZone },
      startDay: '2026-08-10',
      endDay: '2026-08-11',
    });
    const form = await setup({ mode: 'edit', initialOccurrence: overnight, initialNote: '' });

    await form.type('event-form-title', 'Nachtschicht (bestätigt)');
    await form.submit();

    expect(form.saved).toHaveLength(1);
    const changes = (form.saved[0] as { mode: 'edit'; changes: AppEventChanges }).changes;
    expect(changes.start).toEqual({
      kind: 'zoned',
      value: '2026-08-10T22:00:00',
      timeZone: deviceZone,
    });
    expect(changes.end).toEqual({
      kind: 'zoned',
      value: '2026-08-11T02:00:00',
      timeZone: deviceZone,
    });
  });

  it("shifts an overnight occurrence's end date together with the start date the user changes", async () => {
    const overnight = timedOccurrence({
      start: { kind: 'zoned', value: '2026-08-10T22:00:00', timeZone: deviceZone },
      end: { kind: 'zoned', value: '2026-08-11T02:00:00', timeZone: deviceZone },
      startDay: '2026-08-10',
      endDay: '2026-08-11',
    });
    const form = await setup({ mode: 'edit', initialOccurrence: overnight, initialNote: '' });
    await form.expandDateTime();

    await form.type('event-form-date-time-start-date', '2026-08-20');
    await form.submit();

    expect(form.saved).toHaveLength(1);
    const changes = (form.saved[0] as { mode: 'edit'; changes: AppEventChanges }).changes;
    expect(changes.start).toEqual({
      kind: 'zoned',
      value: '2026-08-20T22:00:00',
      timeZone: deviceZone,
    });
    expect(changes.end).toEqual({
      kind: 'zoned',
      value: '2026-08-21T02:00:00',
      timeZone: deviceZone,
    });
  });
});

describe('EventForm, all-day toggle', () => {
  it('shows the start/end time fields by default and hides them once all-day is chosen', async () => {
    const form = await setup({ mode: 'create' });
    await form.expandDateTime();

    expect(form.element.querySelector('#event-form-date-time-start-time')).not.toBeNull();
    expect(form.element.querySelector('#event-form-date-time-end-time')).not.toBeNull();

    await form.pickAllDay(true);

    expect(form.element.querySelector('#event-form-date-time-start-time')).toBeNull();
    expect(form.element.querySelector('#event-form-date-time-end-time')).toBeNull();
  });

  it('shows the time fields again once all-day is turned back off', async () => {
    const form = await setup({ mode: 'create' });
    await form.expandDateTime();

    await form.pickAllDay(true);
    await form.pickAllDay(false);

    expect(form.element.querySelector('#event-form-date-time-start-time')).not.toBeNull();
    expect(form.element.querySelector('#event-form-date-time-end-time')).not.toBeNull();
  });

  it('summarises the collapsed row with the date and time range', async () => {
    const form = await setup({ mode: 'create', initialDate: '2026-08-05' });

    const summary = form.element.querySelector('#event-form-date-time button')!.textContent;
    expect(summary).toContain('2026');
  });

  it('fills the start/end time with a default, like a new appointment, when turning Ganztägig off on an occurrence that was saved as all-day', async () => {
    const allDayOccurrence = timedOccurrence({
      allDay: true,
      start: { kind: 'date', value: '2026-08-10', timeZone: null },
      end: { kind: 'date', value: '2026-08-11', timeZone: null },
    });
    const form = await setup({
      mode: 'edit',
      initialOccurrence: allDayOccurrence,
      initialNote: '',
    });
    await form.expandDateTime();

    await form.pickAllDay(false);

    expect(form.field('event-form-date-time-start-time').value).not.toBe('');
    expect(form.field('event-form-date-time-end-time').value).not.toBe('');
    // The occurrence's stored end (2026-08-11) is the exclusive day after an all-day span, not a
    // date the end-date picker should ever show once the appointment becomes timed.
    expect(form.field('event-form-date-time-end-date').value).toBe('2026-08-10');
  });
});

describe('EventForm, validation', () => {
  it('blocks save while the title is empty, and reveals the error', async () => {
    const form = await setup({ mode: 'create' });
    await form.expandDateTime();

    await form.type('event-form-date-time-start-date', '2026-09-01');
    await form.type('event-form-date-time-start-time', '08:00');
    await form.type('event-form-date-time-end-date', '2026-09-01');
    await form.type('event-form-date-time-end-time', '09:00');
    await form.submit();

    expect(form.saved).toEqual([]);
    expect(form.element.querySelector('.rk-error')).not.toBeNull();
  });

  it('blocks save while the title is only whitespace', async () => {
    const form = await setup({ mode: 'create' });
    await form.expandDateTime();

    await form.type('event-form-title', '   ');
    await form.type('event-form-date-time-start-date', '2026-09-01');
    await form.type('event-form-date-time-start-time', '08:00');
    await form.type('event-form-date-time-end-date', '2026-09-01');
    await form.type('event-form-date-time-end-time', '09:00');
    await form.submit();

    expect(form.saved).toEqual([]);
  });

  it(`blocks save once the title exceeds ${APP_EVENT_TITLE_MAX_LENGTH} characters`, async () => {
    const form = await setup({ mode: 'create' });
    await form.expandDateTime();

    await form.type('event-form-title', 'x'.repeat(APP_EVENT_TITLE_MAX_LENGTH + 1));
    await form.type('event-form-date-time-start-date', '2026-09-01');
    await form.type('event-form-date-time-start-time', '08:00');
    await form.type('event-form-date-time-end-date', '2026-09-01');
    await form.type('event-form-date-time-end-time', '09:00');
    await form.submit();

    expect(form.saved).toEqual([]);
    expect(form.element.querySelector('.rk-error')).not.toBeNull();
  });

  it('blocks save while start/end time is missing and the event is not all-day', async () => {
    const form = await setup({ mode: 'create' });
    await form.expandDateTime();

    await form.type('event-form-title', 'Ohne Uhrzeit');
    await form.type('event-form-date-time-start-date', '2026-09-01');
    await form.submit();

    expect(form.saved).toEqual([]);
  });

  it('does not require start/end time once all-day is chosen', async () => {
    const form = await setup({ mode: 'create' });
    await form.expandDateTime();

    await form.type('event-form-title', 'Feiertag');
    await form.pickAllDay(true);
    await form.type('event-form-date-time-start-date', '2026-09-01');
    await form.type('event-form-date-time-end-date', '2026-09-01');
    await form.submit();

    expect(form.saved).toHaveLength(1);
  });

  it('blocks save when the end time is before the start time on the same day', async () => {
    const form = await setup({ mode: 'create' });
    await form.expandDateTime();

    await form.type('event-form-title', 'Verkehrte Zeiten');
    await form.type('event-form-date-time-start-date', '2026-09-01');
    await form.type('event-form-date-time-start-time', '18:00');
    await form.type('event-form-date-time-end-date', '2026-09-01');
    await form.type('event-form-date-time-end-time', '09:00');
    await form.submit();

    expect(form.saved).toEqual([]);
    expect(form.element.querySelector('.rk-error')?.textContent).toContain(
      'Das Ende muss nach dem Beginn liegen',
    );
  });

  it('blocks save when the end time equals the start time on the same day', async () => {
    const form = await setup({ mode: 'create' });
    await form.expandDateTime();

    await form.type('event-form-title', 'Nulldauer');
    await form.type('event-form-date-time-start-date', '2026-09-01');
    await form.type('event-form-date-time-start-time', '18:00');
    await form.type('event-form-date-time-end-date', '2026-09-01');
    await form.type('event-form-date-time-end-time', '18:00');
    await form.submit();

    expect(form.saved).toEqual([]);
  });

  it('allows an end time after the start time', async () => {
    const form = await setup({ mode: 'create' });
    await form.expandDateTime();

    await form.type('event-form-title', 'Richtige Reihenfolge');
    await form.type('event-form-date-time-start-date', '2026-09-01');
    await form.type('event-form-date-time-start-time', '18:00');
    await form.type('event-form-date-time-end-date', '2026-09-01');
    await form.type('event-form-date-time-end-time', '19:00');
    await form.submit();

    expect(form.saved).toHaveLength(1);
  });

  it('allows an end date after the start date, even with an earlier clock time', async () => {
    const form = await setup({ mode: 'create' });
    await form.expandDateTime();

    await form.type('event-form-title', 'Nachtschicht');
    await form.type('event-form-date-time-start-date', '2026-09-01');
    await form.type('event-form-date-time-start-time', '22:00');
    await form.type('event-form-date-time-end-date', '2026-09-02');
    await form.type('event-form-date-time-end-time', '02:00');
    await form.submit();

    expect(form.saved).toHaveLength(1);
    const draft = (form.saved[0] as { mode: 'create'; draft: AppEventDraft }).draft;
    expect(draft.start).toEqual({
      kind: 'zoned',
      value: '2026-09-01T22:00:00',
      timeZone: deviceZone,
    });
    expect(draft.end).toEqual({
      kind: 'zoned',
      value: '2026-09-02T02:00:00',
      timeZone: deviceZone,
    });
  });

  it('does not apply the end-after-start check once all-day is chosen', async () => {
    const form = await setup({ mode: 'create' });
    await form.expandDateTime();

    await form.type('event-form-title', 'Feiertag');
    await form.pickAllDay(true);
    await form.type('event-form-date-time-start-date', '2026-09-01');
    await form.type('event-form-date-time-end-date', '2026-09-01');
    await form.submit();

    expect(form.saved).toHaveLength(1);
  });
});

describe('EventForm, canSubmit', () => {
  it('is false until the user edits a field, then becomes true', async () => {
    const form = await setup({ mode: 'edit', initialOccurrence: timedOccurrence() });

    expect(form.fixture.componentInstance.canSubmit()).toBe(false);

    await form.type('event-form-title', 'Halb bearbeitet');

    expect(form.fixture.componentInstance.canSubmit()).toBe(true);
  });
});
