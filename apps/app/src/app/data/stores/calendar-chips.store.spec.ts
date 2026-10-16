import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { MAX_STORED_CALENDAR_IDS } from './calendar-chip-preferences';
import { CalendarChipsStore } from './calendar-chips.store';

const STORAGE_KEY = 'rk.calendarChips';

function store(): CalendarChipsStore {
  TestBed.resetTestingModule();
  return TestBed.inject(CalendarChipsStore);
}

describe('CalendarChipsStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with nothing hidden and no arranged order', () => {
    expect(store().preferences()).toEqual({ hiddenCalendarIds: [], calendarOrder: [] });
  });

  it('persists what it is given and reads it back on the next start', () => {
    store().update({ hiddenCalendarIds: ['cal-1'], calendarOrder: ['cal-2', 'cal-1'] });

    expect(store().preferences()).toEqual({
      hiddenCalendarIds: ['cal-1'],
      calendarOrder: ['cal-2', 'cal-1'],
    });
  });

  it('keeps the other list when only one of them is updated', () => {
    const first = store();
    first.update({ calendarOrder: ['cal-2', 'cal-1'] });
    first.update({ hiddenCalendarIds: ['cal-1'] });

    expect(first.preferences().calendarOrder).toEqual(['cal-2', 'cal-1']);
  });

  it('falls back to the defaults when the stored value is not usable', () => {
    localStorage.setItem(STORAGE_KEY, 'nicht json');
    expect(store().preferences()).toEqual({ hiddenCalendarIds: [], calendarOrder: [] });

    localStorage.setItem(STORAGE_KEY, '"eine zeichenkette"');
    expect(store().preferences()).toEqual({ hiddenCalendarIds: [], calendarOrder: [] });

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ hiddenCalendarIds: 'cal-1' }));
    expect(store().preferences().hiddenCalendarIds).toEqual([]);
  });

  it('drops entries that cannot be calendar ids, and duplicates', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ hiddenCalendarIds: ['cal-1', '', 7, null, 'cal-1', 'cal-2'] }),
    );

    expect(store().preferences().hiddenCalendarIds).toEqual(['cal-1', 'cal-2']);
  });

  it('caps a runaway list rather than carrying it forever', () => {
    const ids = Array.from({ length: MAX_STORED_CALENDAR_IDS + 10 }, (_, index) => `cal-${index}`);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ calendarOrder: ids }));

    expect(store().preferences().calendarOrder).toHaveLength(MAX_STORED_CALENDAR_IDS);
  });
});
