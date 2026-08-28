import { TestBed } from '@angular/core/testing';

import { AppearanceStore } from './appearance.store';

const STORAGE_KEY = 'rk.appearance';

describe('AppearanceStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('should start with the default preferences when nothing is stored', () => {
    const store = TestBed.inject(AppearanceStore);

    expect(store.preferences()).toEqual({
      theme: 'amazone',
      textSize: 'system',
      motion: 'system',
      haptics: 'on',
    });
  });

  it('should persist an update and expose it', () => {
    const store = TestBed.inject(AppearanceStore);

    store.update({ theme: 'lila' });

    expect(store.preferences().theme).toBe('lila');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({
      theme: 'lila',
      textSize: 'system',
      motion: 'system',
      haptics: 'on',
    });
  });

  it('should restore persisted preferences', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ theme: 'nacht', textSize: 'large', motion: 'reduced', haptics: 'off' }),
    );

    expect(TestBed.inject(AppearanceStore).preferences()).toEqual({
      theme: 'nacht',
      textSize: 'large',
      motion: 'reduced',
      haptics: 'off',
    });
  });

  it('should accept every step of the text-size ladder, including the pre-existing ones', () => {
    for (const textSize of ['small', 'medium', 'large', 'xlarge', 'xxlarge'] as const) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ textSize }));
      TestBed.resetTestingModule();

      expect(TestBed.inject(AppearanceStore).preferences().textSize).toBe(textSize);
    }
  });

  it('should fall back to the defaults for unknown or malformed values', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ theme: 'himmel', textSize: 42, haptics: 'sometimes' }),
    );

    expect(TestBed.inject(AppearanceStore).preferences()).toEqual({
      theme: 'amazone',
      textSize: 'system',
      motion: 'system',
      haptics: 'on',
    });
  });

  it('should fall back to the defaults when the stored value is not JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'not json');

    expect(TestBed.inject(AppearanceStore).preferences().theme).toBe('amazone');
  });
});
