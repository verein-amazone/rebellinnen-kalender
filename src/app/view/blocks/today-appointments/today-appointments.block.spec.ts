import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LocalDay } from '@app/cross-cutting/infrastructure/local-day';
import type { CalendarOccurrence } from '@app/interactors/calendar/calendar-occurrence.vm';
import { CalendarOccurrencesInteractor } from '@app/interactors/calendar/calendar-occurrences.interactor';

import { TodayAppointmentsBlock } from './today-appointments.block';

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
    title: 'Beratungsgespräch',
    location: null,
    description: null,
    allDay: false,
    start: { kind: 'floating', value: '2026-08-11T14:00:00', timeZone: null },
    end: { kind: 'floating', value: '2026-08-11T15:00:00', timeZone: null },
    startUtc: '2026-08-11T14:00:00Z',
    endUtc: '2026-08-11T15:00:00Z',
    startDay: '2026-08-11',
    endDay: '2026-08-11',
    actions: { editableInApp: true, deletableInApp: true, editViaNativeCalendar: false },
    stale: false,
    sourceName: 'App',
    calendarName: 'Mein Kalender',
    calendarColor: '#7b3fa8',
    calendarEmoji: '📅',
    ...overrides,
  };
}

class FakeCalendarOccurrencesInteractor {
  byDay = new Map<string, CalendarOccurrence[]>();

  listForDays(fromDay: string, toDay: string): Promise<CalendarOccurrence[]> {
    return Promise.resolve(fromDay === toDay ? (this.byDay.get(fromDay) ?? []) : []);
  }
}

async function setup(day: string, occurrences: CalendarOccurrence[] = []) {
  const interactor = new FakeCalendarOccurrencesInteractor();
  interactor.byDay.set(day, occurrences);

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: CalendarOccurrencesInteractor, useValue: interactor },
      { provide: LocalDay, useValue: { day: signal(day).asReadonly() } },
    ],
  });

  const fixture = TestBed.createComponent(TodayAppointmentsBlock);
  await fixture.whenStable();

  return { element: fixture.nativeElement as HTMLElement };
}

describe('TodayAppointmentsBlock', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    // Noon on the fixtures' day, before their 14:00 appointment. Only `Date` is faked, so the
    // fixture's own timers still run.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-11T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the empty state when today has no appointments', async () => {
    const { element } = await setup('2026-08-11');

    expect(element.textContent).toContain('Heute steht noch nichts an.');
  });

  it("lists today's occurrences as cards", async () => {
    const { element } = await setup('2026-08-11', [occurrence()]);

    expect(element.textContent).toContain('Beratungsgespräch');
    expect(element.textContent).not.toContain('Heute steht noch nichts an.');
  });

  it('lists only the next three, leaving the rest to „Alle Termine"', async () => {
    const { element } = await setup(
      '2026-08-11',
      ['13', '14', '15', '16'].map((hour) =>
        occurrence({
          id: `occ-${hour}`,
          title: `Termin um ${hour}`,
          startUtc: `2026-08-11T${hour}:00:00Z`,
          endUtc: `2026-08-11T${hour}:30:00Z`,
        }),
      ),
    );

    expect(element.querySelectorAll('app-occurrence-card')).toHaveLength(3);
    expect(element.textContent).toContain('Termin um 13');
    expect(element.textContent).not.toContain('Termin um 16');
  });

  it('leaves out an appointment that has already ended', async () => {
    const { element } = await setup('2026-08-11', [
      occurrence({
        id: 'occ-past',
        title: 'Frühstück',
        startUtc: '2026-08-11T08:00:00Z',
        endUtc: '2026-08-11T09:00:00Z',
      }),
      occurrence(),
    ]);

    expect(element.textContent).not.toContain('Frühstück');
    expect(element.textContent).toContain('Beratungsgespräch');
  });

  it('says nothing more is coming once every appointment today is over', async () => {
    const { element } = await setup('2026-08-11', [
      occurrence({ startUtc: '2026-08-11T08:00:00Z', endUtc: '2026-08-11T09:00:00Z' }),
    ]);

    expect(element.querySelector('app-occurrence-card')).toBeNull();
    expect(element.textContent).toContain('Heute steht nichts mehr an.');
  });

  it('links „Alle Termine" to the Calendar area', async () => {
    const { element } = await setup('2026-08-11');

    const links = Array.from(element.querySelectorAll('a'));
    const allAppointments = links.find((a) => a.textContent?.includes('Alle Termine'));
    expect(allAppointments?.getAttribute('href')).toBe('/calendar');
  });

  it('keeps „Neuer Termin" pointed at today, and says to come back here', async () => {
    const { element } = await setup('2026-08-11', [occurrence()]);

    const links = Array.from(element.querySelectorAll('a'));
    const newAppointment = links.find((a) => a.textContent?.includes('Neuer Termin'));
    expect(newAppointment?.getAttribute('href')).toBe(
      '/calendar/event/new?day=2026-08-11&returnTo=%2Ftoday',
    );
  });

  it('sends an appointment opened from here back here when it is left', async () => {
    const { element } = await setup('2026-08-11', [occurrence()]);

    const links = Array.from(element.querySelectorAll('a'));
    const appointment = links.find((a) => a.getAttribute('href')?.startsWith('/calendar/event/'));
    expect(appointment?.getAttribute('href')).toContain('returnTo=%2Ftoday');
  });
});
