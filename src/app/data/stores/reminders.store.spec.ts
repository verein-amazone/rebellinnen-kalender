import { TestBed } from '@angular/core/testing';

import { DEFAULT_REMINDER_PREFERENCES } from './reminder-preferences';
import { RemindersStore } from './reminders.store';

const STORAGE_KEY = 'rk.reminders';

describe('RemindersStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('should start with the default preferences when nothing is stored', () => {
    expect(TestBed.inject(RemindersStore).preferences()).toEqual({
      newItemPlacement: 'top',
      completedItemPlacement: 'top',
      hideCompletedAtDayChange: true,
    });
  });

  it('should persist an update and expose it', () => {
    const store = TestBed.inject(RemindersStore);

    store.update({ newItemPlacement: 'bottom' });

    expect(store.preferences().newItemPlacement).toBe('bottom');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({
      ...DEFAULT_REMINDER_PREFERENCES,
      newItemPlacement: 'bottom',
    });
  });

  it('should restore persisted preferences', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        newItemPlacement: 'bottom',
        completedItemPlacement: 'bottom',
        hideCompletedAtDayChange: false,
      }),
    );

    expect(TestBed.inject(RemindersStore).preferences()).toEqual({
      newItemPlacement: 'bottom',
      completedItemPlacement: 'bottom',
      hideCompletedAtDayChange: false,
    });
  });

  it('should fall back to the defaults for an unknown placement', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ newItemPlacement: 'mitte' }));

    expect(TestBed.inject(RemindersStore).preferences().newItemPlacement).toBe('top');
  });

  it('should fall back to the default when the day-change flag is not a boolean', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ hideCompletedAtDayChange: 'ja' }));

    expect(TestBed.inject(RemindersStore).preferences().hideCompletedAtDayChange).toBe(true);
  });

  it('should keep a stored `false` rather than treating it as missing', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ hideCompletedAtDayChange: false }));

    expect(TestBed.inject(RemindersStore).preferences().hideCompletedAtDayChange).toBe(false);
  });

  it('should fall back to the defaults when the stored value is not JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'not json');

    expect(TestBed.inject(RemindersStore).preferences()).toEqual(DEFAULT_REMINDER_PREFERENCES);
  });
});
