import { describe, expect, it } from 'vitest';

import {
  WEEKDAY_HEADERS,
  formatDayLong,
  formatMonthYear,
  formatTimeOfDay,
  formatWeekRangeLabel,
} from './date-format';

describe('formatDayLong', () => {
  it('spells out weekday, day and month in German', () => {
    expect(formatDayLong('2026-08-03')).toBe('Montag, 3. August 2026');
  });
});

describe('formatMonthYear', () => {
  it('spells out month and year', () => {
    expect(formatMonthYear('2026-08-15')).toBe('August 2026');
  });
});

describe('formatWeekRangeLabel', () => {
  it('collapses a week inside one month to a day span', () => {
    expect(formatWeekRangeLabel('2026-08-03', '2026-08-09')).toBe('3.–9. August 2026');
  });

  it('names both months when the week crosses one', () => {
    expect(formatWeekRangeLabel('2026-08-31', '2026-09-06')).toBe('31. Aug. – 6. Sept. 2026');
  });

  it('names both years when the week crosses one', () => {
    expect(formatWeekRangeLabel('2026-12-28', '2027-01-03')).toBe('28. Dez. 2026 – 3. Jan. 2027');
  });
});

describe('formatTimeOfDay', () => {
  it('renders the wall-clock time of a UTC instant at the given offset', () => {
    expect(formatTimeOfDay('2026-08-05T07:30:00Z', '+0200')).toBe('09:30');
  });

  it('uses a 24-hour clock', () => {
    expect(formatTimeOfDay('2026-08-05T16:05:00Z', '+0200')).toBe('18:05');
  });
});

describe('WEEKDAY_HEADERS', () => {
  it('runs Monday to Sunday with short and full names', () => {
    expect(WEEKDAY_HEADERS.map((h) => h.short)).toEqual(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']);
    expect(WEEKDAY_HEADERS[0].long).toBe('Montag');
    expect(WEEKDAY_HEADERS[6].long).toBe('Sonntag');
  });
});
