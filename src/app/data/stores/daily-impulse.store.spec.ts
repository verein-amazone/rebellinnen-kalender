import { TestBed } from '@angular/core/testing';

import { DailyImpulseStore } from './daily-impulse.store';

const STORAGE_KEY = 'rk.dailyImpulse';

describe('DailyImpulseStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('has no stable pick when nothing is stored', () => {
    expect(TestBed.inject(DailyImpulseStore).pick()).toBeNull();
  });

  it('persists a pick and exposes it', () => {
    const store = TestBed.inject(DailyImpulseStore);

    store.setPick('2027-02-05', 'wi-01');

    expect(store.pick()).toEqual({ day: '2027-02-05', itemId: 'wi-01' });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toMatchObject({
      day: '2027-02-05',
      itemId: 'wi-01',
    });
  });

  it('restores a persisted pick', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ day: '2027-02-05', itemId: 'wi-01', recentIds: ['wi-02'] }),
    );

    expect(TestBed.inject(DailyImpulseStore).pick()).toEqual({
      day: '2027-02-05',
      itemId: 'wi-01',
    });
  });

  it('starts with an empty recent-ids window', () => {
    expect(TestBed.inject(DailyImpulseStore).recentIds()).toEqual([]);
  });

  it('restores a persisted recent-ids window', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ day: '2027-02-05', itemId: 'wi-01', recentIds: ['wi-02', 'wi-03'] }),
    );

    expect(TestBed.inject(DailyImpulseStore).recentIds()).toEqual(['wi-02', 'wi-03']);
  });

  it('rolls the picked item into the recent-ids window, keeping only the last 7', () => {
    const store = TestBed.inject(DailyImpulseStore);
    const days = [
      '2027-02-01',
      '2027-02-02',
      '2027-02-03',
      '2027-02-04',
      '2027-02-05',
      '2027-02-06',
      '2027-02-07',
      '2027-02-08',
    ];

    days.forEach((day, index) => store.setPick(day, `item-${index}`));

    expect(store.recentIds()).toEqual([
      'item-1',
      'item-2',
      'item-3',
      'item-4',
      'item-5',
      'item-6',
      'item-7',
    ]);
  });

  it('falls back to no stable pick when the stored value is not JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'not json');

    expect(TestBed.inject(DailyImpulseStore).pick()).toBeNull();
  });

  it('falls back to no stable pick when a stored field has the wrong type', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ day: 123, itemId: 'wi-01' }));

    expect(TestBed.inject(DailyImpulseStore).pick()).toBeNull();
  });
});
