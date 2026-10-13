import { Temporal } from 'temporal-polyfill';

import type { ContentItemRecord } from '@app/data/entities/content-item.record';

import { selectDailyImpulse } from './select-daily-impulse';

function item(overrides: Partial<ContentItemRecord> = {}): ContentItemRecord {
  return {
    id: 'item-1',
    kind: 'wissensimpulse',
    title: 'Titel',
    teaser: 'Teaser',
    bodyMarkdown: 'Text',
    heroImageId: null,
    sourceLabel: null,
    sourceUrl: null,
    relatedSources: [],
    validFrom: null,
    validTo: null,
    eligibleForDaily: true,
    ...overrides,
  };
}

describe('selectDailyImpulse', () => {
  it('returns null when there is nothing eligible', () => {
    expect(
      selectDailyImpulse({ eligible: [], recentIds: [], previous: null, today: '2027-02-05' }),
    ).toBeNull();
  });

  it('picks the only eligible item', () => {
    const only = item({ id: 'only' });

    const picked = selectDailyImpulse({
      eligible: [only],
      recentIds: [],
      previous: null,
      today: '2027-02-05',
    });

    expect(picked).toEqual(only);
  });

  it('favors a single-day item over an evergreen one', () => {
    const evergreen = item({ id: 'evergreen', validFrom: null, validTo: null });
    const oneDay = item({ id: 'one-day', validFrom: '2027-02-05', validTo: '2027-02-05' });

    const picked = selectDailyImpulse({
      eligible: [evergreen, oneDay],
      recentIds: [],
      previous: null,
      today: '2027-02-05',
    });

    expect(picked?.id).toBe('one-day');
  });

  it('favors a narrower eligibility window over a wider one', () => {
    const wideWindow = item({ id: 'wide', validFrom: '2027-02-01', validTo: '2027-02-07' });
    const narrowWindow = item({ id: 'narrow', validFrom: '2027-02-05', validTo: '2027-02-05' });

    const picked = selectDailyImpulse({
      eligible: [wideWindow, narrowWindow],
      recentIds: [],
      previous: null,
      today: '2027-02-05',
    });

    expect(picked?.id).toBe('narrow');
  });

  it('treats an open-ended window (only one of validFrom/validTo set) as evergreen', () => {
    const openEnded = item({ id: 'open-ended', validFrom: '2027-01-01', validTo: null });
    const narrowWindow = item({ id: 'narrow', validFrom: '2027-02-05', validTo: '2027-02-05' });

    const picked = selectDailyImpulse({
      eligible: [openEnded, narrowWindow],
      recentIds: [],
      previous: null,
      today: '2027-02-05',
    });

    expect(picked?.id).toBe('narrow');
  });

  it('excludes ids in recentIds when other eligible items remain', () => {
    const a = item({ id: 'a' });
    const b = item({ id: 'b' });

    const picked = selectDailyImpulse({
      eligible: [a, b],
      recentIds: ['a'],
      previous: null,
      today: '2027-02-05',
    });

    expect(picked?.id).toBe('b');
  });

  it('resets and picks from the full eligible set when recentIds would exclude everything', () => {
    const a = item({ id: 'a' });
    const b = item({ id: 'b' });

    const picked = selectDailyImpulse({
      eligible: [a, b],
      recentIds: ['a', 'b'],
      previous: null,
      today: '2027-02-05',
    });

    expect(['a', 'b']).toContain(picked?.id);
  });

  it('is deterministic for the same inputs', () => {
    const eligible = [item({ id: 'a' }), item({ id: 'b' }), item({ id: 'c' })];

    const first = selectDailyImpulse({
      eligible,
      recentIds: [],
      previous: null,
      today: '2027-02-05',
    });
    const second = selectDailyImpulse({
      eligible,
      recentIds: [],
      previous: null,
      today: '2027-02-05',
    });

    expect(first).toEqual(second);
  });

  it('can pick different items for different days among equally-eligible candidates', () => {
    const eligible = [item({ id: 'a' }), item({ id: 'b' }), item({ id: 'c' }), item({ id: 'd' })];

    const picks = new Set(
      ['2025-01-01', '2025-04-01', '2026-01-01', '2026-04-01'].map(
        (today) => selectDailyImpulse({ eligible, recentIds: [], previous: null, today })?.id,
      ),
    );

    expect(picks.size).toBeGreaterThan(1);
  });

  describe('after the previous impulse', () => {
    /** Every day of 2027, to see how often a kind wins rather than which item one day picks. */
    const YEAR = Array.from({ length: 365 }, (_, index) =>
      Temporal.PlainDate.from('2027-01-01').add({ days: index }).toString(),
    );

    it('makes the kind of the previous impulse unlikely, but not impossible', () => {
      const previous = item({ id: 'reb-01', kind: 'rebellin' });
      const eligible = [item({ id: 'reb-02', kind: 'rebellin' }), item({ id: 'wi-01' })];

      const picks = YEAR.map(
        (today) => selectDailyImpulse({ eligible, recentIds: [], previous, today })?.id,
      );
      const repeats = picks.filter((id) => id === 'reb-02').length;

      // One trait shared weighs a tenth, so about 1 day in 11 repeats the kind.
      expect(repeats).toBeGreaterThan(0);
      expect(repeats).toBeLessThan(YEAR.length * 0.2);
    });

    it('leaves the odds alone without a previous impulse', () => {
      const eligible = [item({ id: 'reb-02', kind: 'rebellin' }), item({ id: 'wi-01' })];

      const picks = YEAR.map(
        (today) => selectDailyImpulse({ eligible, recentIds: [], previous: null, today })?.id,
      );
      const rebellinnen = picks.filter((id) => id === 'reb-02').length;

      expect(rebellinnen).toBeGreaterThan(YEAR.length * 0.35);
      expect(rebellinnen).toBeLessThan(YEAR.length * 0.65);
    });

    it('still picks an item of the same kind when nothing else is eligible', () => {
      const previous = item({ id: 'reb-01', kind: 'rebellin' });
      const only = item({ id: 'reb-02', kind: 'rebellin' });

      const picked = selectDailyImpulse({
        eligible: [only],
        recentIds: [],
        previous,
        today: '2027-02-05',
      });

      expect(picked?.id).toBe('reb-02');
    });

    it('still favors a single-day item of the same kind over an evergreen one of another', () => {
      const previous = item({ id: 'reb-01', kind: 'rebellin' });
      const oneDay = item({
        id: 'reb-02',
        kind: 'rebellin',
        validFrom: '2027-02-05',
        validTo: '2027-02-05',
      });

      const picked = selectDailyImpulse({
        eligible: [item({ id: 'wi-01' }), oneDay],
        recentIds: [],
        previous,
        today: '2027-02-05',
      });

      expect(picked?.id).toBe('reb-02');
    });
  });
});
