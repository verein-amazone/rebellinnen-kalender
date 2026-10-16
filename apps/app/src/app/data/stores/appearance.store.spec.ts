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
      vibration: 'on',
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
      vibration: 'on',
    });
  });

  it('should restore persisted preferences', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        theme: 'nacht',
        textSize: 'large',
        motion: 'reduced',
        vibration: 'off',
      }),
    );

    expect(TestBed.inject(AppearanceStore).preferences()).toEqual({
      theme: 'nacht',
      textSize: 'large',
      motion: 'reduced',
      vibration: 'off',
    });
  });

  // Two older preferences decided whether the phone buzzed: the on/off `haptics` switch and the
  // Tagesimpuls greeting's „Nur Animation“. Whoever turned the vibration off either way keeps it off.
  it('should carry a vibration turned off by an older preference over to the vibration switch', () => {
    for (const legacy of [{ haptics: 'off' }, { impulseGreeting: 'motion' }]) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
      TestBed.resetTestingModule();

      expect(TestBed.inject(AppearanceStore).preferences().vibration).toBe('off');
    }

    for (const legacy of [
      { haptics: 'on' },
      { impulseGreeting: 'full' },
      { impulseGreeting: 'none' },
    ]) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
      TestBed.resetTestingModule();

      expect(TestBed.inject(AppearanceStore).preferences().vibration).toBe('on');
    }
  });

  it('should restore the system theme', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: 'system' }));

    expect(TestBed.inject(AppearanceStore).preferences().theme).toBe('system');
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
      JSON.stringify({ theme: 'himmel', textSize: 42, vibration: 'sometimes' }),
    );

    expect(TestBed.inject(AppearanceStore).preferences()).toEqual({
      theme: 'amazone',
      textSize: 'system',
      motion: 'system',
      vibration: 'on',
    });
  });

  it('should fall back to the defaults when the stored value is not JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'not json');

    expect(TestBed.inject(AppearanceStore).preferences().theme).toBe('amazone');
  });
});
