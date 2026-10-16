import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';

import { deviceLocalDay } from './device-local-day';

const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

describe('deviceLocalDay', () => {
  it('reads a "date" value straight through', () => {
    expect(deviceLocalDay({ kind: 'date', value: '2026-08-10', timeZone: null })).toBe(
      '2026-08-10',
    );
  });

  it('reads the wall-clock date off a "zoned" value', () => {
    expect(
      deviceLocalDay({
        kind: 'zoned',
        value: '2026-08-10T22:00:00',
        timeZone: 'Europe/Vienna',
      }),
    ).toBe('2026-08-10');
  });

  it('reads the wall-clock date off a "floating" value', () => {
    expect(deviceLocalDay({ kind: 'floating', value: '2026-08-10T22:00:00', timeZone: null })).toBe(
      '2026-08-10',
    );
  });

  it('converts a "utc" instant into the device zone', () => {
    const instant = '2026-08-10T22:00:00Z';
    const expected = Temporal.Instant.from(instant)
      .toZonedDateTimeISO(deviceZone)
      .toPlainDate()
      .toString();

    expect(deviceLocalDay({ kind: 'utc', value: instant, timeZone: null })).toBe(expected);
  });
});
