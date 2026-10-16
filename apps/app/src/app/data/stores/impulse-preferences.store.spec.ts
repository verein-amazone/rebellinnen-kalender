import { TestBed } from '@angular/core/testing';

import { ImpulsePreferencesStore } from './impulse-preferences.store';

const STORAGE_KEY = 'rk.impulsePreferences';
const LEGACY_APPEARANCE_KEY = 'rk.appearance';

describe('ImpulsePreferencesStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('should greet on every open when nothing is stored', () => {
    expect(TestBed.inject(ImpulsePreferencesStore).preferences()).toEqual({
      greeting: 'every-open',
    });
  });

  it('should persist an update and expose it', () => {
    const store = TestBed.inject(ImpulsePreferencesStore);

    store.update({ greeting: 'daily' });

    expect(store.preferences().greeting).toBe('daily');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({ greeting: 'daily' });
  });

  it('should restore a persisted preference', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ greeting: 'off' }));

    expect(TestBed.inject(ImpulsePreferencesStore).preferences().greeting).toBe('off');
  });

  it('should fall back to the default for an unknown value or malformed storage', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ greeting: 'sometimes' }));
    expect(TestBed.inject(ImpulsePreferencesStore).preferences().greeting).toBe('every-open');

    localStorage.setItem(STORAGE_KEY, 'not json');
    TestBed.resetTestingModule();
    expect(TestBed.inject(ImpulsePreferencesStore).preferences().greeting).toBe('every-open');
  });

  // The greeting used to live in the appearance preferences. „Ohne Begrüßung“ stays off; the two
  // other values only differed in the vibration, which is its own setting now.
  it('should carry the greeting over from the appearance preferences and write it straight away', () => {
    const cases = [
      ['none', 'off'],
      ['motion', 'every-open'],
      ['full', 'every-open'],
    ] as const;

    for (const [legacy, expected] of cases) {
      localStorage.clear();
      localStorage.setItem(LEGACY_APPEARANCE_KEY, JSON.stringify({ impulseGreeting: legacy }));
      TestBed.resetTestingModule();

      expect(TestBed.inject(ImpulsePreferencesStore).preferences().greeting).toBe(expected);
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({ greeting: expected });
    }
  });

  it('should prefer its own entry over the legacy appearance value', () => {
    localStorage.setItem(LEGACY_APPEARANCE_KEY, JSON.stringify({ impulseGreeting: 'none' }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ greeting: 'daily' }));

    expect(TestBed.inject(ImpulsePreferencesStore).preferences().greeting).toBe('daily');
  });
});
