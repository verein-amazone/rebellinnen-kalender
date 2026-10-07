import { continuedAfter, toUtcInstantString, truncatedBefore } from './rrule-tools';

describe('continuedAfter', () => {
  it('leaves only what is left of COUNT', () => {
    expect(continuedAfter('FREQ=WEEKLY;BYDAY=MO;COUNT=6', 2)).toBe('FREQ=WEEKLY;COUNT=4;BYDAY=MO');
  });

  it('never goes below the split occurrence itself', () => {
    expect(continuedAfter('FREQ=DAILY;COUNT=3', 5)).toBe('FREQ=DAILY;COUNT=1');
  });

  it('keeps UNTIL and an open end as they are', () => {
    expect(continuedAfter('FREQ=DAILY;UNTIL=20261231', 4)).toBe('FREQ=DAILY;UNTIL=20261231');
    expect(continuedAfter('FREQ=WEEKLY;BYDAY=MO', 4)).toBe('FREQ=WEEKLY;BYDAY=MO');
  });
});

describe('truncatedBefore', () => {
  it('replaces COUNT and an earlier UNTIL with the new end', () => {
    expect(
      truncatedBefore(
        'FREQ=DAILY;UNTIL=20261231;INTERVAL=2',
        { kind: 'date', value: '2026-10-12', timeZone: null },
        '2026-10-20',
      ),
    ).toBe('FREQ=DAILY;INTERVAL=2;UNTIL=20261019');
  });

  it('ends a zoned series one second before the split, in UTC', () => {
    expect(
      truncatedBefore(
        'FREQ=WEEKLY;BYDAY=MO;COUNT=10',
        { kind: 'zoned', value: '2026-10-12T18:00:00', timeZone: 'Europe/Vienna' },
        '2026-10-26T18:00:00',
      ),
    ).toBe('FREQ=WEEKLY;BYDAY=MO;UNTIL=20261026T165959Z');
  });

  it('ends an all-day series on the day before the split', () => {
    expect(
      truncatedBefore(
        'FREQ=DAILY',
        { kind: 'date', value: '2026-10-12', timeZone: null },
        '2026-10-20',
      ),
    ).toBe('FREQ=DAILY;UNTIL=20261019');
  });
});

describe('toUtcInstantString', () => {
  it('resolves a zoned value in its own zone and a date in the device zone', () => {
    expect(
      toUtcInstantString(
        { kind: 'zoned', value: '2026-10-12T18:00:00', timeZone: 'Europe/Vienna' },
        'UTC',
      ),
    ).toBe('2026-10-12T16:00:00Z');
    expect(
      toUtcInstantString({ kind: 'date', value: '2026-10-12', timeZone: null }, 'Europe/Vienna'),
    ).toBe('2026-10-11T22:00:00Z');
  });
});
