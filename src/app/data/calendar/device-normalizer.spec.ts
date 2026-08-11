import type { DeviceEventInstance } from '../gateways/native-calendar.gateway';
import { normalizeDeviceInstances } from './device-normalizer';

function instance(overrides: Partial<DeviceEventInstance> = {}): DeviceEventInstance {
  return {
    eventId: 'event-1',
    calendarId: 'cal-1',
    title: 'Zahnarzt',
    location: null,
    description: null,
    // Matches what the gateway actually produces (`utcInstantFromEpochMilliseconds`), not
    // `Date#toISOString()` — the normalizer stores this string verbatim as the occurrence's
    // start_utc/end_utc, so it must already be in the format range queries compare against.
    startUtc: '2026-08-10T08:00:00Z',
    endUtc: '2026-08-10T09:00:00Z',
    isAllDay: false,
    timeZone: 'Europe/Vienna',
    ...overrides,
  };
}

describe('normalizeDeviceInstances', () => {
  it('builds a composite identity of platform, calendar, event and start', () => {
    const rows = normalizeDeviceInstances('device', 'ios', [instance()], 'Europe/Vienna');

    expect(rows[0].id).toBe('device:ios:cal-1:event-1#2026-08-10T08:00:00Z');
    expect(rows[0].provenance).toBe('device-cached');
    expect(rows[0].externalId).toBe('event-1');
    expect(rows[0].sourceType).toBe('device');
  });

  it('keeps instances of one series apart although iOS repeats the event id', () => {
    const rows = normalizeDeviceInstances(
      'device',
      'ios',
      [instance(), instance({ startUtc: '2026-08-17T08:00:00Z', endUtc: '2026-08-17T09:00:00Z' })],
      'Europe/Vienna',
    );

    expect(new Set(rows.map((row) => row.id)).size).toBe(2);
  });

  it('collapses a duplicate instance returned twice at a range seam', () => {
    const rows = normalizeDeviceInstances(
      'device',
      'ios',
      [instance(), instance()],
      'Europe/Vienna',
    );

    expect(rows).toHaveLength(1);
  });

  it('drops instances without a calendar', () => {
    const rows = normalizeDeviceInstances(
      'device',
      'android',
      [instance({ calendarId: null })],
      'Europe/Vienna',
    );

    expect(rows).toEqual([]);
  });

  it('turns an all-day instance into local dates with an inclusive last day', () => {
    // Native all-day events span exclusive midnights: 22:00Z-22:00Z is Aug 10 in Vienna.
    const rows = normalizeDeviceInstances(
      'device',
      'android',
      [
        instance({
          isAllDay: true,
          startUtc: '2026-08-09T22:00:00Z',
          endUtc: '2026-08-10T22:00:00Z',
        }),
      ],
      'Europe/Vienna',
    );

    expect(rows[0].isAllDay).toBe(true);
    expect(rows[0].start).toEqual({ kind: 'date', value: '2026-08-10', timeZone: null });
    expect(rows[0].startLocalDay).toBe('2026-08-10');
    expect(rows[0].endLocalDay).toBe('2026-08-10');
  });

  it('does not count a timed instance ending exactly at midnight into the next day', () => {
    const rows = normalizeDeviceInstances(
      'device',
      'android',
      [
        instance({
          startUtc: '2026-08-10T20:00:00Z',
          // Midnight in Vienna during DST.
          endUtc: '2026-08-10T22:00:00Z',
        }),
      ],
      'Europe/Vienna',
    );

    expect(rows[0].startLocalDay).toBe('2026-08-10');
    expect(rows[0].endLocalDay).toBe('2026-08-10');
  });
});
