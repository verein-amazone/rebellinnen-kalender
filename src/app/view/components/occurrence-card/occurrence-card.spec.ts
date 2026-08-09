import { Component, input, LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import type { CalendarOccurrence } from '@app/interactors/calendar/calendar-occurrence.vm';

import { OccurrenceCard } from './occurrence-card';

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

@Component({
  imports: [OccurrenceCard],
  template: `<app-occurrence-card [occurrence]="occurrence()" [day]="day()" timeZone="+0200" />`,
})
class Host {
  readonly occurrence = input.required<CalendarOccurrence>();
  readonly day = input.required<string>();
}

async function setup(
  entry: CalendarOccurrence,
  day = '2026-08-05',
): Promise<{ element: HTMLElement }> {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: LOCALE_ID, useValue: 'de' }],
  });

  const fixture = TestBed.createComponent(Host);
  fixture.componentRef.setInput('occurrence', entry);
  fixture.componentRef.setInput('day', day);
  await fixture.whenStable();

  return { element: fixture.nativeElement as HTMLElement };
}

describe('OccurrenceCard', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('is a link to the occurrence detail screen named after the appointment', async () => {
    const { element } = await setup(occurrence());

    const link = element.querySelector('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('/calendar/event/occ-1');
    expect(link?.textContent).toContain('Workshop');
  });

  it('shows start and end time for a timed appointment', async () => {
    const { element } = await setup(occurrence());

    expect(element.textContent).toContain('09:30');
    expect(element.textContent).toContain('11:00');
    expect(element.textContent).not.toContain('Ganztägig');
  });

  it('labels an all-day appointment instead of showing times', async () => {
    const { element } = await setup(
      occurrence({
        allDay: true,
        start: { kind: 'date', value: '2026-08-05', timeZone: null },
        end: null,
        startUtc: '2026-08-04T22:00:00Z',
        endUtc: '2026-08-05T22:00:00Z',
      }),
    );

    expect(element.textContent).toContain('Ganztägig');
    expect(element.textContent).not.toContain('09:30');
  });

  it('shows only the end time, never "Ganztägig", for a timed appointment on the day it ends', async () => {
    const { element } = await setup(
      occurrence({
        startDay: '2026-08-04',
        endDay: '2026-08-05',
        startUtc: '2026-08-04T20:00:00Z',
        endUtc: '2026-08-05T09:00:00Z',
      }),
      '2026-08-05',
    );

    expect(element.textContent).not.toContain('Ganztägig');
    expect(element.textContent).toContain('bis');
    expect(element.textContent).toContain('11:00');
  });

  it('shows only the start time, with "ab", on the day a multi-day timed appointment starts', async () => {
    const { element } = await setup(
      occurrence({
        startDay: '2026-08-05',
        endDay: '2026-08-07',
        startUtc: '2026-08-05T07:30:00Z',
        endUtc: '2026-08-07T09:00:00Z',
      }),
      '2026-08-05',
    );

    expect(element.textContent).not.toContain('Ganztägig');
    expect(element.textContent).toContain('ab');
    expect(element.textContent).toContain('09:30');
  });

  it('labels a day a timed appointment merely passes through as "Ganztägig", same as a real all-day one', async () => {
    const { element } = await setup(
      occurrence({
        startDay: '2026-08-04',
        endDay: '2026-08-06',
        startUtc: '2026-08-04T07:30:00Z',
        endUtc: '2026-08-06T09:00:00Z',
      }),
      '2026-08-05',
    );

    expect(element.textContent).toContain('Ganztägig');
  });

  it('labels the first day of a multi-day all-day appointment "Ganztägig"', async () => {
    const { element } = await setup(
      occurrence({
        allDay: true,
        start: { kind: 'date', value: '2026-08-04', timeZone: null },
        end: null,
        startDay: '2026-08-04',
        endDay: '2026-08-06',
        startUtc: '2026-08-03T22:00:00Z',
        endUtc: '2026-08-06T22:00:00Z',
      }),
      '2026-08-04',
    );

    expect(element.textContent).toContain('Ganztägig');
  });

  it('labels the middle day of a multi-day all-day appointment "Ganztägig"', async () => {
    const { element } = await setup(
      occurrence({
        allDay: true,
        start: { kind: 'date', value: '2026-08-04', timeZone: null },
        end: null,
        startDay: '2026-08-04',
        endDay: '2026-08-06',
        startUtc: '2026-08-03T22:00:00Z',
        endUtc: '2026-08-06T22:00:00Z',
      }),
      '2026-08-05',
    );

    expect(element.textContent).toContain('Ganztägig');
  });

  it('labels the last day of a multi-day all-day appointment "Ganztägig"', async () => {
    const { element } = await setup(
      occurrence({
        allDay: true,
        start: { kind: 'date', value: '2026-08-04', timeZone: null },
        end: null,
        startDay: '2026-08-04',
        endDay: '2026-08-06',
        startUtc: '2026-08-03T22:00:00Z',
        endUtc: '2026-08-06T22:00:00Z',
      }),
      '2026-08-06',
    );

    expect(element.textContent).toContain('Ganztägig');
  });

  it('shows the location when there is one', async () => {
    const { element } = await setup(occurrence({ location: 'Jugendtreff' }));

    expect(element.textContent).toContain('Jugendtreff');
  });

  it('names the calendar the appointment belongs to', async () => {
    const { element } = await setup(occurrence());

    expect(element.textContent).toContain('Mein Kalender');
  });
});
