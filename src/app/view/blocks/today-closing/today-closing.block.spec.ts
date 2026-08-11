import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { LocalDay } from '@app/cross-cutting/infrastructure/local-day';
import { ReminderChanges } from '@app/cross-cutting/infrastructure/reminder-changes';
import { CalendarOccurrencesInteractor } from '@app/interactors/calendar/calendar-occurrences.interactor';
import type { CalendarOccurrence } from '@app/interactors/calendar/calendar-occurrence.vm';
import { ReminderListInteractor } from '@app/interactors/reminders/reminder-list.interactor';
import type { Reminder } from '@app/interactors/reminders/reminder.vm';

import { TodayClosingBlock } from './today-closing.block';

function occurrence(overrides: Partial<CalendarOccurrence> = {}): CalendarOccurrence {
  return {
    id: 'o1',
    sourceId: 's1',
    calendarId: 'c1',
    seriesId: null,
    originalStart: null,
    itemId: null,
    externalId: null,
    kind: 'event',
    title: 'Treffen AG Gleichstellung',
    location: null,
    description: null,
    allDay: false,
    start: { kind: 'floating', value: '2026-08-11T17:30:00', timeZone: null },
    end: { kind: 'floating', value: '2026-08-11T18:30:00', timeZone: null },
    startUtc: '2026-08-11T17:30:00Z',
    endUtc: '2026-08-11T18:30:00Z',
    startDay: '2026-08-11',
    endDay: '2026-08-11',
    actions: { editableInApp: true, deletableInApp: true, editViaNativeCalendar: false },
    stale: false,
    sourceName: 'App',
    calendarName: 'Privat',
    calendarColor: null,
    calendarEmoji: null,
    ...overrides,
  };
}

class FakeReminderListInteractor {
  items: Reminder[] = [];

  list(): Promise<Reminder[]> {
    return Promise.resolve(this.items);
  }
}

class FakeCalendarOccurrencesInteractor {
  byRange = new Map<string, CalendarOccurrence[]>();

  listForDays(fromDay: string, toDay: string): Promise<CalendarOccurrence[]> {
    return Promise.resolve(this.byRange.get(`${fromDay}|${toDay}`) ?? []);
  }
}

async function setup(config: {
  reminders?: Reminder[];
  todayOccurrences?: CalendarOccurrence[];
  tomorrowOccurrences?: CalendarOccurrence[];
  today?: string;
}) {
  const reminders = new FakeReminderListInteractor();
  reminders.items = config.reminders ?? [];

  const occurrences = new FakeCalendarOccurrencesInteractor();
  const today = config.today ?? '2026-08-11';
  const tomorrow = '2026-08-12';
  occurrences.byRange.set(`${today}|${today}`, config.todayOccurrences ?? []);
  occurrences.byRange.set(`${tomorrow}|${tomorrow}`, config.tomorrowOccurrences ?? []);

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ReminderListInteractor, useValue: reminders },
      { provide: CalendarOccurrencesInteractor, useValue: occurrences },
      { provide: LocalDay, useValue: { day: signal(today).asReadonly() } },
    ],
  });

  const fixture = TestBed.createComponent(TodayClosingBlock);
  await fixture.whenStable();

  return {
    element: fixture.nativeElement as HTMLElement,
    reminders,
    reminderChanges: TestBed.inject(ReminderChanges),
    settle: () => fixture.whenStable(),
  };
}

describe('TodayClosingBlock', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('shows the open-reminders headline when reminders are open and nothing else is scheduled', async () => {
    const { element } = await setup({
      reminders: [{ id: 'r1', text: 'Milch kaufen', completed: false }],
    });

    expect(element.textContent).toContain('Noch 1 Punkt für heute');
  });

  it('shows the appointment title as a link when a future appointment remains today', async () => {
    const { element } = await setup({ todayOccurrences: [occurrence()] });

    const link = element.querySelector('a');
    expect(link?.textContent).toContain('Treffen AG Gleichstellung');
  });

  it('shows the nothing-planned headline when there is nothing at all for today', async () => {
    const { element } = await setup({});

    const nothingPlannedHeadlines = [
      'Heute ist nichts weiter geplant',
      'Für heute steht nichts mehr an',
      'Heute bleibt Zeit für dich',
    ];
    expect(
      nothingPlannedHeadlines.some((headline) => element.textContent?.includes(headline)),
    ).toBe(true);
  });

  it('reloads and shows the new state when ReminderChanges reports a write to the reminders list', async () => {
    const { element, reminders, reminderChanges, settle } = await setup({ reminders: [] });

    expect(element.textContent).not.toContain('Noch 1 Punkt für heute');

    reminders.items = [{ id: 'r1', text: 'Milch kaufen', completed: false }];
    reminderChanges.notify();
    await settle();

    expect(element.textContent).toContain('Noch 1 Punkt für heute');
  });
});
