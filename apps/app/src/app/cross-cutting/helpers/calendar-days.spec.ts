import { describe, expect, it } from 'vitest';

import { addMonths, addWeeks, daysInRange, monthGridRange, weekRange } from './calendar-days';

describe('weekRange', () => {
  it('spans Monday to Sunday around a mid-week day', () => {
    // 2026-08-05 is a Wednesday.
    expect(weekRange('2026-08-05')).toEqual({ fromDay: '2026-08-03', toDay: '2026-08-09' });
  });

  it('starts on the day itself when it is a Monday', () => {
    expect(weekRange('2026-08-03')).toEqual({ fromDay: '2026-08-03', toDay: '2026-08-09' });
  });

  it('reaches back a full week from a Sunday', () => {
    expect(weekRange('2026-08-09')).toEqual({ fromDay: '2026-08-03', toDay: '2026-08-09' });
  });

  it('crosses a month boundary', () => {
    // 2026-08-01 is a Saturday.
    expect(weekRange('2026-08-01')).toEqual({ fromDay: '2026-07-27', toDay: '2026-08-02' });
  });

  it('crosses a year boundary', () => {
    // 2027-01-01 is a Friday.
    expect(weekRange('2027-01-01')).toEqual({ fromDay: '2026-12-28', toDay: '2027-01-03' });
  });
});

describe('monthGridRange', () => {
  it('covers leading and trailing out-of-month days to full weeks', () => {
    // August 2026: the 1st is a Saturday, the 31st a Monday.
    expect(monthGridRange('2026-08-15')).toEqual({ fromDay: '2026-07-27', toDay: '2026-09-06' });
  });

  it('starts on the 1st when the month begins on a Monday', () => {
    // June 2026 begins on a Monday.
    expect(monthGridRange('2026-06-10')).toEqual({ fromDay: '2026-06-01', toDay: '2026-07-05' });
  });

  it('ends on the last day when the month ends on a Sunday', () => {
    // May 2026 ends on Sunday the 31st.
    expect(monthGridRange('2026-05-01')).toEqual({ fromDay: '2026-04-27', toDay: '2026-05-31' });
  });
});

describe('daysInRange', () => {
  it('lists every day inclusive of both bounds', () => {
    expect(daysInRange('2026-08-30', '2026-09-02')).toEqual([
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
    ]);
  });

  it('returns a single day when the bounds are equal', () => {
    expect(daysInRange('2026-08-05', '2026-08-05')).toEqual(['2026-08-05']);
  });
});

describe('addWeeks', () => {
  it('moves forward across a month boundary', () => {
    expect(addWeeks('2026-08-28', 1)).toBe('2026-09-04');
  });

  it('moves backward', () => {
    expect(addWeeks('2026-08-05', -1)).toBe('2026-07-29');
  });
});

describe('addMonths', () => {
  it('moves forward a calendar month', () => {
    expect(addMonths('2026-08-05', 1)).toBe('2026-09-05');
  });

  it('clamps to the shorter month instead of overflowing', () => {
    expect(addMonths('2026-08-31', 1)).toBe('2026-09-30');
  });

  it('moves backward across a year boundary', () => {
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15');
  });
});
