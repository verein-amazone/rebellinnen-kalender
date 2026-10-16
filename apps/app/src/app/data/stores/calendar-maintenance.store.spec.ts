import { TestBed } from '@angular/core/testing';

import { CalendarMaintenanceStore } from './calendar-maintenance.store';

const STORAGE_KEY = 'rk.calendar-maintenance';

describe('CalendarMaintenanceStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('knows no zone before one was remembered', () => {
    expect(TestBed.inject(CalendarMaintenanceStore).lastTimeZone()).toBeNull();
  });

  it('remembers the zone the rows were computed in, also for a new store instance', () => {
    TestBed.inject(CalendarMaintenanceStore).rememberTimeZone('Europe/Vienna');

    TestBed.resetTestingModule();

    expect(TestBed.inject(CalendarMaintenanceStore).lastTimeZone()).toBe('Europe/Vienna');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({
      lastTimeZone: 'Europe/Vienna',
    });
  });

  it.each([
    ['not JSON', 'not json'],
    ['a zone that is not a string', JSON.stringify({ lastTimeZone: 7 })],
    ['a missing zone', JSON.stringify({})],
    ['no object', JSON.stringify('Europe/Vienna')],
  ])('treats %s as no zone, so the rows are rebuilt', (_, stored) => {
    localStorage.setItem(STORAGE_KEY, stored);

    expect(TestBed.inject(CalendarMaintenanceStore).lastTimeZone()).toBeNull();
  });

  it('carries on when the storage cannot be written', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    expect(() =>
      TestBed.inject(CalendarMaintenanceStore).rememberTimeZone('Europe/Vienna'),
    ).not.toThrow();

    setItem.mockRestore();
  });
});
