import { TestBed } from '@angular/core/testing';

import { IntroStore } from './intro.store';

const STORAGE_KEY = 'rk.intro';

describe('IntroStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('starts unseen', () => {
    expect(TestBed.inject(IntroStore).seenAt()).toBeNull();
  });

  it('persists when the introduction was seen', () => {
    TestBed.inject(IntroStore).markSeen('2026-10-06T10:00:00.000Z');

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({
      seenAt: '2026-10-06T10:00:00.000Z',
      step: 1,
    });
    TestBed.resetTestingModule();
    expect(TestBed.inject(IntroStore).seenAt()).toBe('2026-10-06T10:00:00.000Z');
  });

  it('persists the step reached', () => {
    TestBed.inject(IntroStore).rememberStep(3);

    TestBed.resetTestingModule();
    expect(TestBed.inject(IntroStore).step()).toBe(3);
  });

  it('forgets everything on reset', () => {
    const store = TestBed.inject(IntroStore);
    store.rememberStep(3);
    store.markSeen('2026-10-06T10:00:00.000Z');

    store.reset();

    expect(store.seenAt()).toBeNull();
    expect(store.step()).toBe(1);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('reads an entry from before steps were remembered', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ seenAt: '2026-10-06T10:00:00.000Z' }));

    const store = TestBed.inject(IntroStore);
    expect(store.seenAt()).toBe('2026-10-06T10:00:00.000Z');
    expect(store.step()).toBe(1);
  });

  it('treats a malformed entry as unseen', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(TestBed.inject(IntroStore).seenAt()).toBeNull();

    TestBed.resetTestingModule();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ seenAt: 42, step: 'two' }));
    expect(TestBed.inject(IntroStore).seenAt()).toBeNull();
    expect(TestBed.inject(IntroStore).step()).toBe(1);
  });
});
