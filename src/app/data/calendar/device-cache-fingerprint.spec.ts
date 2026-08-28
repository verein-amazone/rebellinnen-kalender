import type { OccurrenceRecord } from '../entities/occurrence.record';
import { fingerprintOccurrences } from './device-cache-fingerprint';

function occurrence(overrides: Partial<OccurrenceRecord> = {}): OccurrenceRecord {
  return {
    id: 'device:ios:cal-1:event-1#2026-08-10T02:00:00Z',
    sourceId: 'device',
    sourceType: 'device',
    calendarId: 'device-cal:cal-1',
    seriesId: null,
    originalStart: null,
    provenance: 'device-cached',
    itemKind: 'event',
    itemId: null,
    title: 'Zahnarzt',
    location: null,
    description: null,
    isAllDay: false,
    start: { kind: 'utc', value: '2026-08-10T02:00:00Z', timeZone: null },
    end: { kind: 'utc', value: '2026-08-10T03:00:00Z', timeZone: null },
    startUtc: '2026-08-10T02:00:00Z',
    endUtc: '2026-08-10T03:00:00Z',
    startLocalDay: '2026-08-10',
    endLocalDay: '2026-08-10',
    externalId: 'event-1',
    ...overrides,
  };
}

const other = occurrence({ id: 'device:ios:cal-1:event-2#2026-08-11T02:00:00Z', title: 'Yoga' });

describe('fingerprintOccurrences', () => {
  it('is stable for an empty set', () => {
    expect(fingerprintOccurrences([])).toBe(fingerprintOccurrences([]));
  });

  it('ignores the order the provider returned the rows in', () => {
    // The native side is free to reorder identical data; reacting to that would rewrite the whole
    // window for nothing.
    expect(fingerprintOccurrences([occurrence(), other])).toBe(
      fingerprintOccurrences([other, occurrence()]),
    );
  });

  it('changes when a field a column stores changes', () => {
    const base = fingerprintOccurrences([occurrence()]);

    expect(fingerprintOccurrences([occurrence({ title: 'Zahnarzt (verschoben)' })])).not.toBe(base);
    expect(fingerprintOccurrences([occurrence({ startUtc: '2026-08-10T04:00:00Z' })])).not.toBe(
      base,
    );
    expect(fingerprintOccurrences([occurrence({ location: 'Ordination' })])).not.toBe(base);
    expect(fingerprintOccurrences([occurrence({ isAllDay: true })])).not.toBe(base);
    expect(fingerprintOccurrences([occurrence({ startLocalDay: '2026-08-11' })])).not.toBe(base);
    expect(fingerprintOccurrences([occurrence({ end: null })])).not.toBe(base);
  });

  it('changes when a row is added or removed', () => {
    const one = fingerprintOccurrences([occurrence()]);
    const two = fingerprintOccurrences([occurrence(), other]);

    expect(one).not.toBe(two);
    expect(fingerprintOccurrences([other])).not.toBe(one);
  });

  it('does not let a value ending where the next begins hash the same', () => {
    // Without a separator between fields, ("ab", "c") and ("a", "bc") would be indistinguishable.
    expect(fingerprintOccurrences([occurrence({ title: 'ab', location: 'c' })])).not.toBe(
      fingerprintOccurrences([occurrence({ title: 'a', location: 'bc' })]),
    );
  });

  it('carries the row count so a mismatch is visible without decoding anything', () => {
    expect(fingerprintOccurrences([occurrence(), other]).startsWith('2-')).toBe(true);
    expect(fingerprintOccurrences([]).startsWith('0-')).toBe(true);
  });
});
