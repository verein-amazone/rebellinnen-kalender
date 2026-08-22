import type { ContentItemRecord } from '@app/data/entities/content-item.record';

import { selectDailyImpulse } from './select-daily-impulse';

function item(overrides: Partial<ContentItemRecord> = {}): ContentItemRecord {
  return {
    id: 'item-1',
    kind: 'wissensimpulse',
    title: 'Titel',
    teaser: 'Teaser',
    bodyMarkdown: 'Text',
    imagePath: null,
    imageAttribution: null,
    sourceLabel: null,
    sourceUrl: null,
    validFrom: null,
    validTo: null,
    eligibleForDaily: true,
    ...overrides,
  };
}

describe('selectDailyImpulse', () => {
  it('returns null when there is nothing eligible', () => {
    expect(selectDailyImpulse({ eligible: [], recentIds: [], today: '2027-02-05' })).toBeNull();
  });

  it('picks the only eligible item', () => {
    const only = item({ id: 'only' });

    const picked = selectDailyImpulse({ eligible: [only], recentIds: [], today: '2027-02-05' });

    expect(picked).toEqual(only);
  });

  it('prefers a date-specific item over an evergreen one', () => {
    const evergreen = item({ id: 'evergreen', validFrom: null, validTo: null });
    const dated = item({ id: 'dated', validFrom: '2027-02-01', validTo: '2027-02-10' });

    const picked = selectDailyImpulse({
      eligible: [evergreen, dated],
      recentIds: [],
      today: '2027-02-05',
    });

    expect(picked?.id).toBe('dated');
  });

  it('excludes ids in recentIds when other eligible items remain', () => {
    const a = item({ id: 'a' });
    const b = item({ id: 'b' });

    const picked = selectDailyImpulse({
      eligible: [a, b],
      recentIds: ['a'],
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
      today: '2027-02-05',
    });

    expect(['a', 'b']).toContain(picked?.id);
  });

  it('is deterministic for the same inputs', () => {
    const eligible = [item({ id: 'a' }), item({ id: 'b' }), item({ id: 'c' })];

    const first = selectDailyImpulse({ eligible, recentIds: [], today: '2027-02-05' });
    const second = selectDailyImpulse({ eligible, recentIds: [], today: '2027-02-05' });

    expect(first).toEqual(second);
  });

  it('can pick different items for different days among equally-eligible candidates', () => {
    const eligible = [item({ id: 'a' }), item({ id: 'b' }), item({ id: 'c' }), item({ id: 'd' })];

    const picks = new Set(
      ['2027-02-01', '2027-02-02', '2027-02-03', '2027-02-04', '2027-02-05'].map(
        (today) => selectDailyImpulse({ eligible, recentIds: [], today })?.id,
      ),
    );

    expect(picks.size).toBeGreaterThan(1);
  });
});
