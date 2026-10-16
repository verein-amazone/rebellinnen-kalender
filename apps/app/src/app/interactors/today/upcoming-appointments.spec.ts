import { describe, expect, it } from 'vitest';

import type { CalendarOccurrence } from '@app/interactors/calendar/calendar-occurrence.vm';

import { selectUpcomingAppointments } from './upcoming-appointments';

const NOON_UTC = '2026-08-11T12:00:00Z';

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
    title: 'Treffen',
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
    calendarName: 'Privat',
    calendarColor: '#7b3fa8',
    calendarEmoji: null,
    ...overrides,
  };
}

function timed(id: string, startUtc: string, endUtc: string): CalendarOccurrence {
  return occurrence({ id, startUtc, endUtc });
}

describe('selectUpcomingAppointments', () => {
  it('drops appointments that have already ended', () => {
    const shown = selectUpcomingAppointments(
      [
        timed('past', '2026-08-11T08:00:00Z', '2026-08-11T09:00:00Z'),
        timed('later', '2026-08-11T14:00:00Z', '2026-08-11T15:00:00Z'),
      ],
      NOON_UTC,
    );

    expect(shown.map((entry) => entry.id)).toEqual(['later']);
  });

  it('keeps an appointment that is under way', () => {
    const shown = selectUpcomingAppointments(
      [timed('now', '2026-08-11T11:30:00Z', '2026-08-11T12:30:00Z')],
      NOON_UTC,
    );

    expect(shown.map((entry) => entry.id)).toEqual(['now']);
  });

  it('keeps an all-day entry for the whole day', () => {
    const shown = selectUpcomingAppointments(
      [
        occurrence({
          id: 'holiday',
          allDay: true,
          startUtc: '2026-08-10T22:00:00Z',
          endUtc: '2026-08-11T22:00:00Z',
        }),
      ],
      '2026-08-11T21:30:00Z',
    );

    expect(shown.map((entry) => entry.id)).toEqual(['holiday']);
  });

  it('returns the next three in the given order and leaves the rest out', () => {
    const shown = selectUpcomingAppointments(
      [
        timed('a', '2026-08-11T13:00:00Z', '2026-08-11T13:30:00Z'),
        timed('b', '2026-08-11T14:00:00Z', '2026-08-11T14:30:00Z'),
        timed('c', '2026-08-11T15:00:00Z', '2026-08-11T15:30:00Z'),
        timed('d', '2026-08-11T16:00:00Z', '2026-08-11T16:30:00Z'),
      ],
      NOON_UTC,
    );

    expect(shown.map((entry) => entry.id)).toEqual(['a', 'b', 'c']);
  });
});
