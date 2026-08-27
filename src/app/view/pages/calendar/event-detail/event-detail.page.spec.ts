import { LiveAnnouncer } from '@angular/cdk/a11y';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { of, type Observable } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import {
  AppCalendarsInteractor,
  type WritableAppCalendar,
} from '@app/interactors/calendar/app-calendars.interactor';
import {
  AppEventEditingInteractor,
  type AppEventChanges,
} from '@app/interactors/calendar/app-event-editing.interactor';
import { CalendarOccurrencesInteractor } from '@app/interactors/calendar/calendar-occurrences.interactor';
import type { CalendarOccurrence } from '@app/interactors/calendar/calendar-occurrence.vm';
import { DeviceCalendarSyncInteractor } from '@app/interactors/calendar/device-calendar-sync.interactor';
import { EventForm, type AppEventFormResult } from '@app/view/components/event-form/event-form';
import { SheetService } from '@app/view/components/sheet/sheet.service';

import { EventDetailPage } from './event-detail.page';

function occurrence(overrides: Partial<CalendarOccurrence> = {}): CalendarOccurrence {
  return {
    id: 'occ-1',
    sourceId: 'source-app',
    calendarId: 'cal-1',
    seriesId: null,
    originalStart: null,
    itemId: 'item-1',
    externalId: null,
    kind: 'event',
    title: 'Zahnarzt',
    location: 'Praxis Dr. Muster',
    description: null,
    allDay: false,
    start: { kind: 'zoned', value: '2026-08-10T09:00:00', timeZone: 'Europe/Vienna' },
    end: { kind: 'zoned', value: '2026-08-10T10:30:00', timeZone: 'Europe/Vienna' },
    startUtc: '2026-08-10T07:00:00Z',
    endUtc: '2026-08-10T08:30:00Z',
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

class FakeCalendarOccurrencesInteractor {
  result: CalendarOccurrence | null = null;
  readonly calls: string[] = [];
  loader = (): Promise<CalendarOccurrence | null> => Promise.resolve(this.result);

  findById(id: string): Promise<CalendarOccurrence | null> {
    this.calls.push(id);
    return this.loader();
  }
}

class FakeAppEventEditingInteractor {
  note: string | null = 'Zahnreinigung nicht vergessen';
  readonly findRecordCalls: string[] = [];
  readonly updateAllCalls: { itemId: string; changes: AppEventChanges }[] = [];
  readonly updateOccurrenceCalls: {
    seriesId: string;
    originalStart: string;
    changes: AppEventChanges;
  }[] = [];
  readonly updateFollowingCalls: {
    seriesId: string;
    originalStart: string;
    changes: AppEventChanges;
  }[] = [];
  readonly deleteItemCalls: string[] = [];
  readonly cancelOccurrenceCalls: { seriesId: string; originalStart: string }[] = [];
  readonly deleteFollowingCalls: { seriesId: string; originalStart: string }[] = [];

  findRecord(itemId: string): Promise<{ note: string | null } | null> {
    this.findRecordCalls.push(itemId);
    return Promise.resolve({ note: this.note });
  }

  updateAll(itemId: string, changes: AppEventChanges): Promise<void> {
    this.updateAllCalls.push({ itemId, changes });
    return Promise.resolve();
  }

  updateOccurrence(
    seriesId: string,
    originalStart: string,
    changes: AppEventChanges,
  ): Promise<void> {
    this.updateOccurrenceCalls.push({ seriesId, originalStart, changes });
    return Promise.resolve();
  }

  updateFollowing(
    seriesId: string,
    originalStart: string,
    changes: AppEventChanges,
  ): Promise<void> {
    this.updateFollowingCalls.push({ seriesId, originalStart, changes });
    return Promise.resolve();
  }

  deleteItem(itemId: string): Promise<void> {
    this.deleteItemCalls.push(itemId);
    return Promise.resolve();
  }

  cancelOccurrence(seriesId: string, originalStart: string): Promise<void> {
    this.cancelOccurrenceCalls.push({ seriesId, originalStart });
    return Promise.resolve();
  }

  deleteFollowing(seriesId: string, originalStart: string): Promise<void> {
    this.deleteFollowingCalls.push({ seriesId, originalStart });
    return Promise.resolve();
  }
}

class FakeAppCalendarsInteractor {
  calendars: WritableAppCalendar[] = [
    { id: 'cal-1', name: 'Privat', color: '#a1b2c3', emoji: '🏠' },
  ];

  listWritable(): Promise<WritableAppCalendar[]> {
    return Promise.resolve(this.calendars);
  }
}

class FakeDeviceCalendarSyncInteractor {
  readonly openForEditingCalls: string[] = [];
  readonly refreshCalls: { force?: boolean }[] = [];
  openForEditingResult: 'resolve' | 'reject' = 'resolve';

  openForEditing(eventId: string): Promise<void> {
    this.openForEditingCalls.push(eventId);
    return this.openForEditingResult === 'resolve'
      ? Promise.resolve()
      : Promise.reject(new Error('native prompt rejected'));
  }

  refresh(options: { force?: boolean } = {}): Promise<void> {
    this.refreshCalls.push(options);
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

class StubLiveAnnouncer {
  readonly announcements: string[] = [];

  announce(message: string): Promise<void> {
    this.announcements.push(message);
    return Promise.resolve();
  }
}

async function setup(inputs: {
  id: string;
  occurrence?: CalendarOccurrence | null;
  note?: string | null;
}) {
  const occurrencesInteractor = new FakeCalendarOccurrencesInteractor();
  occurrencesInteractor.result = inputs.occurrence ?? null;

  const eventEditing = new FakeAppEventEditingInteractor();
  if (inputs.note !== undefined) {
    eventEditing.note = inputs.note;
  }

  const deviceSync = new FakeDeviceCalendarSyncInteractor();
  const sheets = new StubSheetService();
  const announcer = new StubLiveAnnouncer();

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: LOCALE_ID, useValue: 'de' },
      { provide: CalendarOccurrencesInteractor, useValue: occurrencesInteractor },
      { provide: AppEventEditingInteractor, useValue: eventEditing },
      { provide: AppCalendarsInteractor, useValue: new FakeAppCalendarsInteractor() },
      { provide: DeviceCalendarSyncInteractor, useValue: deviceSync },
      { provide: SheetService, useValue: sheets },
      { provide: LiveAnnouncer, useValue: announcer },
    ],
  });

  const navigate = vi.fn().mockResolvedValue(true);
  TestBed.inject(Router).navigate = navigate;
  const navigateByUrl = vi.fn().mockResolvedValue(true);
  TestBed.inject(Router).navigateByUrl = navigateByUrl;

  const fixture = TestBed.createComponent(EventDetailPage);
  fixture.componentRef.setInput('id', inputs.id);
  await fixture.whenStable();

  return {
    fixture,
    element: fixture.nativeElement as HTMLElement,
    occurrencesInteractor,
    eventEditing: eventEditing as unknown as AppEventEditingInteractor &
      FakeAppEventEditingInteractor,
    deviceSync,
    sheets,
    announcer,
    navigate,
    navigateByUrl,
    settle: () => fixture.whenStable(),
    button(label: string): HTMLButtonElement | undefined {
      return Array.from(fixture.nativeElement.querySelectorAll('button')).find((candidate) =>
        (candidate as HTMLButtonElement).textContent?.includes(label),
      ) as HTMLButtonElement | undefined;
    },
    async emitFormSave(result: AppEventFormResult) {
      const formDebug = fixture.debugElement.query(By.directive(EventForm));
      (formDebug.componentInstance as EventForm).save.emit(result);
      await fixture.whenStable();
    },
  };
}

describe('EventDetailPage, loading', () => {
  it('shows a loading indicator while the occurrence resolves', async () => {
    const occurrencesInteractor = new FakeCalendarOccurrencesInteractor();
    let resolveLoad!: (value: CalendarOccurrence | null) => void;
    occurrencesInteractor.loader = () =>
      new Promise((resolve) => {
        resolveLoad = resolve;
      });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: LOCALE_ID, useValue: 'de' },
        { provide: CalendarOccurrencesInteractor, useValue: occurrencesInteractor },
        { provide: AppEventEditingInteractor, useValue: new FakeAppEventEditingInteractor() },
        { provide: AppCalendarsInteractor, useValue: new FakeAppCalendarsInteractor() },
        { provide: DeviceCalendarSyncInteractor, useValue: new FakeDeviceCalendarSyncInteractor() },
        { provide: SheetService, useValue: new StubSheetService() },
        { provide: LiveAnnouncer, useValue: new StubLiveAnnouncer() },
      ],
    });

    const fixture = TestBed.createComponent(EventDetailPage);
    fixture.componentRef.setInput('id', 'occ-1');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.rk-skeleton')).not.toBeNull();

    resolveLoad(occurrence());
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Zahnarzt');
  });

  it('reports when the occurrence cannot be found', async () => {
    const { element } = await setup({ id: 'missing', occurrence: null });

    expect(element.textContent).toContain('konnte nicht gefunden werden');
  });
});

describe('EventDetailPage, read view', () => {
  it('renders the calendar source, title, date, time, location and note', async () => {
    const { element } = await setup({
      id: 'occ-1',
      occurrence: occurrence(),
      note: 'Zahnreinigung nicht vergessen',
    });

    expect(element.textContent).toContain('Zahnarzt');
    expect(element.textContent).toContain('Privat');
    expect(element.textContent).toContain('Praxis Dr. Muster');
    expect(element.textContent).toContain('Zahnreinigung nicht vergessen');
    expect(element.textContent).toContain('Montag, 10. August 2026');
  });

  it('shows „Ganztägig“ for an all-day occurrence instead of a time range', async () => {
    const { element } = await setup({
      id: 'occ-1',
      occurrence: occurrence({ allDay: true }),
    });

    expect(element.textContent).toContain('Ganztägig');
  });
});

describe('EventDetailPage, actions by capability', () => {
  it('shows Edit and Delete for an app-owned occurrence', async () => {
    const { button } = await setup({
      id: 'occ-1',
      occurrence: occurrence({
        actions: { editableInApp: true, deletableInApp: true, editViaNativeCalendar: false },
      }),
    });

    expect(button('Bearbeiten')).toBeTruthy();
    expect(button('Löschen')).toBeTruthy();
    expect(button('In Kalender-App bearbeiten')).toBeFalsy();
  });

  it('shows the native-calendar action for a writable device occurrence', async () => {
    const { button, element } = await setup({
      id: 'occ-1',
      occurrence: occurrence({
        itemId: null,
        externalId: 'native-1',
        actions: { editableInApp: false, deletableInApp: false, editViaNativeCalendar: true },
      }),
    });

    expect(button('Bearbeiten')).toBeFalsy();
    expect(button('Löschen')).toBeFalsy();
    expect(button('In Kalender-App bearbeiten')).toBeTruthy();
    expect(element.textContent).not.toContain('konnte nicht gefunden');
  });

  it('shows no action buttons and a read-only note for a read-only occurrence', async () => {
    const { button, element } = await setup({
      id: 'occ-1',
      occurrence: occurrence({
        itemId: null,
        actions: { editableInApp: false, deletableInApp: false, editViaNativeCalendar: false },
      }),
    });

    expect(button('Bearbeiten')).toBeFalsy();
    expect(button('Löschen')).toBeFalsy();
    expect(button('In Kalender-App bearbeiten')).toBeFalsy();
    expect(element.textContent).toMatch(/nicht bearbeitet|nicht gelöscht|schreibgeschützt/i);
  });

  it('opens the native calendar edit prompt and refreshes the cache afterwards', async () => {
    const { button, deviceSync, settle } = await setup({
      id: 'occ-1',
      occurrence: occurrence({
        itemId: null,
        externalId: 'native-1',
        actions: { editableInApp: false, deletableInApp: false, editViaNativeCalendar: true },
      }),
    });

    button('In Kalender-App bearbeiten')?.click();
    await settle();

    expect(deviceSync.openForEditingCalls).toEqual(['native-1']);
  });

  it('reloads the occurrence after returning from the native calendar app', async () => {
    const { button, occurrencesInteractor, settle } = await setup({
      id: 'occ-1',
      occurrence: occurrence({
        itemId: null,
        externalId: 'native-1',
        actions: { editableInApp: false, deletableInApp: false, editViaNativeCalendar: true },
      }),
    });
    const callsBeforeHandoff = occurrencesInteractor.calls.length;

    button('In Kalender-App bearbeiten')?.click();
    await settle();

    // The page's own `occurrenceResource` only reflects what was loaded before the handoff unless
    // reloaded explicitly - `openForEditing` refreshes the device cache, not this resource.
    expect(occurrencesInteractor.calls.length).toBeGreaterThan(callsBeforeHandoff);
  });

  it('announces a German error and does not throw when the native handoff is rejected', async () => {
    const { button, deviceSync, announcer, settle } = await setup({
      id: 'occ-1',
      occurrence: occurrence({
        itemId: null,
        externalId: 'native-1',
        actions: { editableInApp: false, deletableInApp: false, editViaNativeCalendar: true },
      }),
    });
    deviceSync.openForEditingResult = 'reject';

    // No unhandled rejection: the click handler's own promise must resolve, not reject.
    await expect(async () => {
      button('In Kalender-App bearbeiten')?.click();
      await settle();
    }).not.toThrow();

    expect(
      announcer.announcements.some((message) => /nicht.*(geöffnet|Kalender-App)/i.test(message)),
    ).toBe(true);
  });
});

describe('EventDetailPage, edit', () => {
  it('toggles into edit mode showing the event form pre-filled from the occurrence and note', async () => {
    const { button, element, settle } = await setup({
      id: 'occ-1',
      occurrence: occurrence(),
      note: 'Zahnreinigung nicht vergessen',
    });

    button('Bearbeiten')?.click();
    await settle();

    expect(element.querySelector('app-event-form')).toBeTruthy();
    expect(element.querySelector<HTMLInputElement>('#event-form-title')?.value).toBe('Zahnarzt');
    expect(element.querySelector<HTMLTextAreaElement>('#event-form-note')?.value).toBe(
      'Zahnreinigung nicht vergessen',
    );
  });

  it('saves a standalone item directly, announces, and returns to the occurrence day', async () => {
    const { button, settle, emitFormSave, eventEditing, announcer, navigate } = await setup({
      id: 'occ-1',
      occurrence: occurrence(),
    });

    button('Bearbeiten')?.click();
    await settle();

    const changes: AppEventChanges = { title: 'Zahnarzt (verschoben)' };
    await emitFormSave({ mode: 'edit', changes });

    expect(eventEditing.updateAllCalls).toEqual([{ itemId: 'item-1', changes }]);
    expect(announcer.announcements).toContain('Termin gespeichert');
    expect(navigate).toHaveBeenCalledWith(['/calendar'], {
      queryParams: { day: '2026-08-10' },
      replaceUrl: true,
    });
  });

  it('navigates to the new day when the save moves the appointment to a different date', async () => {
    const { button, settle, emitFormSave, eventEditing, navigate } = await setup({
      id: 'occ-1',
      occurrence: occurrence(),
    });

    button('Bearbeiten')?.click();
    await settle();

    const changes: AppEventChanges = {
      title: 'Zahnarzt (verschoben)',
      start: { kind: 'zoned', value: '2026-08-15T09:00:00', timeZone: 'Europe/Vienna' },
    };
    await emitFormSave({ mode: 'edit', changes });

    expect(eventEditing.updateAllCalls).toEqual([{ itemId: 'item-1', changes }]);
    // Not '2026-08-10' (the occurrence's pre-edit day) - the day the user actually moved it to.
    expect(navigate).toHaveBeenCalledWith(['/calendar'], {
      queryParams: { day: '2026-08-15' },
      replaceUrl: true,
    });
  });

  it('moves focus to the edit heading when entering edit mode', async () => {
    const { button, element, settle } = await setup({
      id: 'occ-1',
      occurrence: occurrence(),
    });

    button('Bearbeiten')?.click();
    await settle();

    const heading = element.querySelector('h2');
    expect(heading?.textContent).toContain('Termin bearbeiten');
    expect(document.activeElement).toBe(heading);
  });

  it("returns to the calendar on the occurrence's own day when the back-arrow is used", async () => {
    // The calendar overview keeps the day the user was looking at in `?day=`. A bare `/calendar`
    // would drop them back on today instead of where they came from, so the back target carries it.
    const { button, settle, navigateByUrl } = await setup({
      id: 'occ-1',
      occurrence: occurrence({ startDay: '2026-08-10' }),
    });

    button('Zurück')?.click();
    await settle();

    expect(navigateByUrl).toHaveBeenCalledWith('/calendar?day=2026-08-10', { replaceUrl: true });
  });

  it('returns focus to the „Bearbeiten“ button when the header back-arrow cancels edit mode', async () => {
    const { button, settle } = await setup({
      id: 'occ-1',
      occurrence: occurrence(),
    });

    button('Bearbeiten')?.click();
    await settle();

    // The header back-arrow's accessible name is "Zurück" (a visually hidden span); while editing,
    // it exits edit mode instead of leaving the screen - see `handleBeforeDismiss`.
    button('Zurück')?.click();
    await settle();

    expect(document.activeElement).toBe(button('Bearbeiten'));
  });

  it('cancels edit mode via the header back-arrow without calling any interactor method', async () => {
    const { button, element, settle, eventEditing } = await setup({
      id: 'occ-1',
      occurrence: occurrence(),
    });

    button('Bearbeiten')?.click();
    await settle();

    button('Zurück')?.click();
    await settle();

    expect(element.querySelector('app-event-form')).toBeFalsy();
    expect(button('Bearbeiten')).toBeTruthy();
    expect(eventEditing.updateAllCalls).toEqual([]);
  });

  for (const scope of ['occurrence', 'following', 'all'] as const) {
    it(`saves a series occurrence through the "${scope}" scope`, async () => {
      const { button, settle, emitFormSave, eventEditing, sheets, navigate } = await setup({
        id: 'occ-1',
        occurrence: occurrence({
          seriesId: 'series-1',
          originalStart: '2026-08-10T09:00:00[Europe/Vienna]',
          itemId: 'series-1',
        }),
      });
      sheets.results = [scope];

      button('Bearbeiten')?.click();
      await settle();

      const changes: AppEventChanges = { title: 'Verschoben' };
      await emitFormSave({ mode: 'edit', changes });

      expect(sheets.opens).toHaveLength(1);

      if (scope === 'occurrence') {
        expect(eventEditing.updateOccurrenceCalls).toEqual([
          { seriesId: 'series-1', originalStart: '2026-08-10T09:00:00[Europe/Vienna]', changes },
        ]);
      } else if (scope === 'following') {
        expect(eventEditing.updateFollowingCalls).toEqual([
          { seriesId: 'series-1', originalStart: '2026-08-10T09:00:00[Europe/Vienna]', changes },
        ]);
      } else {
        expect(eventEditing.updateAllCalls).toEqual([{ itemId: 'series-1', changes }]);
      }

      expect(navigate).toHaveBeenCalledWith(['/calendar'], {
        queryParams: { day: '2026-08-10' },
        replaceUrl: true,
      });
    });
  }

  it('stays in edit mode and mutates nothing when the recurrence-scope dialog is dismissed', async () => {
    const { button, element, settle, emitFormSave, eventEditing, sheets, navigate } = await setup({
      id: 'occ-1',
      occurrence: occurrence({
        seriesId: 'series-1',
        originalStart: '2026-08-10T09:00:00[Europe/Vienna]',
        itemId: 'series-1',
      }),
    });
    sheets.results = [undefined];

    button('Bearbeiten')?.click();
    await settle();

    await emitFormSave({ mode: 'edit', changes: { title: 'Verschoben' } });

    expect(eventEditing.updateOccurrenceCalls).toEqual([]);
    expect(eventEditing.updateFollowingCalls).toEqual([]);
    expect(eventEditing.updateAllCalls).toEqual([]);
    expect(navigate).not.toHaveBeenCalled();
    expect(element.querySelector('app-event-form')).toBeTruthy();
  });
});

describe('EventDetailPage, delete', () => {
  it('asks for confirmation, deletes a standalone item, announces and navigates', async () => {
    const { button, settle, sheets, eventEditing, announcer, navigate } = await setup({
      id: 'occ-1',
      occurrence: occurrence(),
    });
    sheets.results = [true];

    button('Löschen')?.click();
    await settle();

    expect(sheets.opens[0]?.heading).toContain('löschen');
    expect(eventEditing.deleteItemCalls).toEqual(['item-1']);
    expect(announcer.announcements).toContain('Termin gelöscht');
    expect(navigate).toHaveBeenCalledWith(['/calendar'], {
      queryParams: { day: '2026-08-10' },
      replaceUrl: true,
    });
  });

  it('does nothing when the delete confirmation is declined', async () => {
    const { button, settle, sheets, eventEditing, navigate } = await setup({
      id: 'occ-1',
      occurrence: occurrence(),
    });
    sheets.results = [false];

    button('Löschen')?.click();
    await settle();

    expect(eventEditing.deleteItemCalls).toEqual([]);
    expect(navigate).not.toHaveBeenCalled();
  });

  for (const scope of ['occurrence', 'following', 'all'] as const) {
    it(`deletes a series occurrence through the "${scope}" scope`, async () => {
      const { button, settle, sheets, eventEditing, navigate } = await setup({
        id: 'occ-1',
        occurrence: occurrence({
          seriesId: 'series-1',
          originalStart: '2026-08-10T09:00:00[Europe/Vienna]',
          itemId: 'series-1',
        }),
      });
      sheets.results = [true, scope];

      button('Löschen')?.click();
      await settle();

      expect(sheets.opens).toHaveLength(2);

      if (scope === 'occurrence') {
        expect(eventEditing.cancelOccurrenceCalls).toEqual([
          { seriesId: 'series-1', originalStart: '2026-08-10T09:00:00[Europe/Vienna]' },
        ]);
      } else if (scope === 'following') {
        expect(eventEditing.deleteFollowingCalls).toEqual([
          { seriesId: 'series-1', originalStart: '2026-08-10T09:00:00[Europe/Vienna]' },
        ]);
      } else {
        expect(eventEditing.deleteItemCalls).toEqual(['series-1']);
      }

      expect(navigate).toHaveBeenCalledWith(['/calendar'], {
        queryParams: { day: '2026-08-10' },
        replaceUrl: true,
      });
    });
  }

  it('stays put and mutates nothing when the recurrence-scope dialog is dismissed after confirming', async () => {
    const { button, settle, sheets, eventEditing, navigate } = await setup({
      id: 'occ-1',
      occurrence: occurrence({
        seriesId: 'series-1',
        originalStart: '2026-08-10T09:00:00[Europe/Vienna]',
        itemId: 'series-1',
      }),
    });
    sheets.results = [true, undefined];

    button('Löschen')?.click();
    await settle();

    expect(eventEditing.cancelOccurrenceCalls).toEqual([]);
    expect(eventEditing.deleteFollowingCalls).toEqual([]);
    expect(eventEditing.deleteItemCalls).toEqual([]);
    expect(navigate).not.toHaveBeenCalled();
  });
});
