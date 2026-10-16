import { describe, expect, it } from 'vitest';

import type { CalendarOccurrence } from '@app/interactors/calendar/calendar-occurrence.vm';
import type { Reminder } from '@app/interactors/reminders/reminder.vm';

import { selectTodayClosingState } from './today-closing-state';

const TODAY = '2026-08-11';
const TOMORROW = '2026-08-12';
const NOON_UTC = '2026-08-11T12:00:00Z';
const LATE_EVENING_UTC = '2026-08-11T21:00:00Z';

function reminder(overrides: Partial<Reminder> = {}): Reminder {
  return { id: 'r1', text: 'Milch kaufen', completed: false, ...overrides };
}

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
    startDay: TODAY,
    endDay: TODAY,
    actions: { editableInApp: true, deletableInApp: true, editViaNativeCalendar: false },
    stale: false,
    sourceName: 'App',
    calendarName: 'Privat',
    calendarColor: null,
    calendarEmoji: null,
    ...overrides,
  };
}

describe('selectTodayClosingState', () => {
  it('picks appointment-later when a future appointment remains today', () => {
    const result = selectTodayClosingState({
      reminders: [],
      todayOccurrences: [occurrence()],
      tomorrowOccurrences: [],
      nowUtc: NOON_UTC,
    });

    expect(result.id).toBe('appointment-later');
    expect(result.nextAppointment?.id).toBe('o1');
    expect(result.supportingLineKey).toBe('appointment-later.next');
  });

  it('picks open-reminders when reminders are open and no future appointment remains', () => {
    const result = selectTodayClosingState({
      reminders: [reminder({ completed: false })],
      todayOccurrences: [],
      tomorrowOccurrences: [],
      nowUtc: NOON_UTC,
    });

    expect(result.id).toBe('open-reminders');
    expect(result.openReminderCount).toBe(1);
  });

  it('never claims completion while an open reminder remains, even after every appointment has passed', () => {
    const result = selectTodayClosingState({
      reminders: [reminder({ completed: false })],
      todayOccurrences: [occurrence({ endUtc: '2026-08-11T09:00:00Z' })],
      tomorrowOccurrences: [],
      nowUtc: NOON_UTC,
    });

    expect(result.id).toBe('open-reminders');
  });

  it('never claims completion while a future appointment remains, even with no open reminders', () => {
    const result = selectTodayClosingState({
      reminders: [reminder({ completed: true })],
      todayOccurrences: [occurrence()],
      tomorrowOccurrences: [],
      nowUtc: NOON_UTC,
    });

    expect(result.id).toBe('appointment-later');
  });

  it('leads with the reminder count and follows with the appointment time when both remain, per the issue’s mixed-state example', () => {
    const result = selectTodayClosingState({
      reminders: [reminder({ completed: false })],
      todayOccurrences: [occurrence()],
      tomorrowOccurrences: [],
      nowUtc: NOON_UTC,
    });

    expect(result.id).toBe('appointment-later');
    expect(result.headlineKey).toBe('open-reminders.headline.one');
    expect(result.supportingLineKey).toBe('appointment-later.withReminders');
    expect(result.nextAppointment?.id).toBe('o1');
  });

  it('uses the singular reminder-count headline key for exactly one open reminder', () => {
    const result = selectTodayClosingState({
      reminders: [reminder({ id: 'r1', completed: false })],
      todayOccurrences: [],
      tomorrowOccurrences: [],
      nowUtc: NOON_UTC,
    });

    expect(result.headlineKey).toBe('open-reminders.headline.one');
  });

  it('uses the plural reminder-count headline key for more than one open reminder', () => {
    const result = selectTodayClosingState({
      reminders: [
        reminder({ id: 'r1', completed: false }),
        reminder({ id: 'r2', completed: false }),
      ],
      todayOccurrences: [],
      tomorrowOccurrences: [],
      nowUtc: NOON_UTC,
    });

    expect(result.headlineKey).toBe('open-reminders.headline.many');
    expect(result.openReminderCount).toBe(2);
  });

  it('picks all-done when reminders are complete, no future appointment remains, and it is not yet evening', () => {
    const result = selectTodayClosingState({
      reminders: [reminder({ completed: true })],
      todayOccurrences: [occurrence({ endUtc: '2026-08-11T09:00:00Z' })],
      tomorrowOccurrences: [],
      nowUtc: NOON_UTC,
    });

    expect(result.id).toBe('all-done');
  });

  it('picks day-over instead of all-done once it is late evening, with no open reminders', () => {
    const result = selectTodayClosingState({
      reminders: [reminder({ completed: true })],
      todayOccurrences: [occurrence({ endUtc: '2026-08-11T09:00:00Z' })],
      tomorrowOccurrences: [],
      nowUtc: LATE_EVENING_UTC,
    });

    expect(result.id).toBe('day-over');
    expect(result.supportingLineKey).toBe('day-over.goodnight');
  });

  it('picks nothing-planned when there are no reminders at all and no appointments today', () => {
    const result = selectTodayClosingState({
      reminders: [],
      todayOccurrences: [],
      tomorrowOccurrences: [],
      nowUtc: NOON_UTC,
    });

    expect(result.id).toBe('nothing-planned');
    expect(result.supportingLineKey).toBeNull();
  });

  it('attaches a tomorrow preview to nothing-planned when tomorrow has an appointment', () => {
    const tomorrowOccurrence = occurrence({
      id: 'o2',
      startDay: TOMORROW,
      endDay: TOMORROW,
      startUtc: '2026-08-12T10:00:00Z',
      endUtc: '2026-08-12T11:00:00Z',
    });

    const result = selectTodayClosingState({
      reminders: [],
      todayOccurrences: [],
      tomorrowOccurrences: [tomorrowOccurrence],
      nowUtc: NOON_UTC,
    });

    expect(result.id).toBe('nothing-planned');
    expect(result.supportingLineKey).toBe('nothing-planned.tomorrowPreview');
    expect(result.tomorrowAppointment?.id).toBe('o2');
  });

  it('does not attach a tomorrow preview when nothing is scheduled tomorrow either', () => {
    const result = selectTodayClosingState({
      reminders: [],
      todayOccurrences: [],
      tomorrowOccurrences: [],
      nowUtc: NOON_UTC,
    });

    expect(result.tomorrowAppointment).toBeNull();
  });

  it('never treats an all-day entry as the next appointment - it has no clock time to state', () => {
    const allDay = occurrence({
      allDay: true,
      startDay: TODAY,
      endDay: TODAY,
      start: { kind: 'date', value: TODAY, timeZone: null },
      end: null,
      startUtc: '2026-08-11T00:00:00Z',
      endUtc: '2026-08-12T00:00:00Z',
    });

    const result = selectTodayClosingState({
      reminders: [],
      todayOccurrences: [allDay],
      tomorrowOccurrences: [],
      nowUtc: NOON_UTC,
    });

    // The day still counts as planned, so it settles on all-done rather than nothing-planned.
    expect(result.id).toBe('all-done');
    expect(result.nextAppointment).toBeNull();
  });

  it('skips an all-day entry and picks the next timed appointment behind it', () => {
    const allDay = occurrence({
      id: 'o-all-day',
      allDay: true,
      startDay: TODAY,
      endDay: TODAY,
      start: { kind: 'date', value: TODAY, timeZone: null },
      end: null,
      startUtc: '2026-08-11T00:00:00Z',
      endUtc: '2026-08-12T00:00:00Z',
    });
    const timed = occurrence({
      id: 'o-timed',
      startUtc: '2026-08-11T16:00:00Z',
      endUtc: '2026-08-11T17:00:00Z',
    });

    const result = selectTodayClosingState({
      reminders: [],
      todayOccurrences: [allDay, timed],
      tomorrowOccurrences: [],
      nowUtc: NOON_UTC,
    });

    expect(result.id).toBe('appointment-later');
    expect(result.nextAppointment?.id).toBe('o-timed');
    expect(result.supportingLineKey).toBe('appointment-later.next');
  });

  it('ignores an all-day entry when previewing tomorrow', () => {
    const allDayTomorrow = occurrence({
      id: 'o2',
      allDay: true,
      startDay: TOMORROW,
      endDay: TOMORROW,
      start: { kind: 'date', value: TOMORROW, timeZone: null },
      end: null,
      startUtc: '2026-08-12T00:00:00Z',
      endUtc: '2026-08-13T00:00:00Z',
    });

    const result = selectTodayClosingState({
      reminders: [],
      todayOccurrences: [],
      tomorrowOccurrences: [allDayTomorrow],
      nowUtc: NOON_UTC,
    });

    expect(result.tomorrowAppointment).toBeNull();
    expect(result.supportingLineKey).toBeNull();
  });
});
