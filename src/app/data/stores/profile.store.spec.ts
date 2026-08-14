import { TestBed } from '@angular/core/testing';

import { ProfileStore } from './profile.store';

const STORAGE_KEY = 'rk.profile';

describe('ProfileStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('should start with the default preferences when nothing is stored', () => {
    const store = TestBed.inject(ProfileStore);

    expect(store.preferences()).toEqual({ name: null, emoji: '⭐' });
  });

  it('should persist an update and expose it', () => {
    const store = TestBed.inject(ProfileStore);

    store.update({ name: 'Nina', emoji: '🌻' });

    expect(store.preferences()).toEqual({ name: 'Nina', emoji: '🌻' });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({
      name: 'Nina',
      emoji: '🌻',
    });
  });

  it('should restore persisted preferences', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: 'Nina', emoji: '🌻' }));

    expect(TestBed.inject(ProfileStore).preferences()).toEqual({ name: 'Nina', emoji: '🌻' });
  });

  it('should fall back to the default emoji when the stored emoji is empty or not a string', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: 'Nina', emoji: '' }));
    expect(TestBed.inject(ProfileStore).preferences().emoji).toBe('⭐');

    TestBed.resetTestingModule();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: 'Nina', emoji: 42 }));
    expect(TestBed.inject(ProfileStore).preferences().emoji).toBe('⭐');
  });

  it('should fall back to no name when the stored name is not a string', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: 42, emoji: '⭐' }));

    expect(TestBed.inject(ProfileStore).preferences().name).toBeNull();
  });

  it('should clamp an overlong stored name to the maximum length', () => {
    const overlong = 'x'.repeat(60);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: overlong, emoji: '⭐' }));

    expect(TestBed.inject(ProfileStore).preferences().name).toBe('x'.repeat(40));
  });

  it('should fall back to the defaults when the stored value is not JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'not json');

    expect(TestBed.inject(ProfileStore).preferences()).toEqual({ name: null, emoji: '⭐' });
  });
});
