import type { AppItemExceptionRecord, AppItemRecord } from '../../entities/app-item.record';
import { materializeAppItem, type MaterializationContext } from './occurrence-materializer';

function item(overrides: Partial<AppItemRecord> = {}): AppItemRecord {
  return {
    id: 'series-1',
    calendarId: 'calendar-1',
    kind: 'event',
    title: 'Plenum',
    location: 'Vereinslokal',
    note: null,
    start: { kind: 'zoned', value: '2026-10-12T18:00:00', timeZone: 'Europe/Vienna' },
    end: { kind: 'zoned', value: '2026-10-12T20:00:00', timeZone: 'Europe/Vienna' },
    rrule: 'FREQ=WEEKLY;BYDAY=MO',
    predecessorSeriesId: null,
    ruleRevision: 0,
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    ...overrides,
  };
}

function exception(overrides: Partial<AppItemExceptionRecord> = {}): AppItemExceptionRecord {
  return {
    seriesId: 'series-1',
    originalStart: '2026-10-19T18:00:00',
    status: 'override',
    title: null,
    location: null,
    note: null,
    start: null,
    end: null,
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    ...overrides,
  };
}

function context(overrides: Partial<MaterializationContext> = {}): MaterializationContext {
  return {
    sourceId: 'source-1',
    windowStartUtc: '2026-10-01T00:00:00Z',
    windowEndUtc: '2026-11-15T00:00:00Z',
    timeZone: 'Europe/Vienna',
    ...overrides,
  };
}

describe('materializeAppItem', () => {
  it('keeps the wall time constant across the DST end, so the UTC instants shift', () => {
    const { occurrences, truncated } = materializeAppItem(item(), [], context());

    expect(truncated).toBe(false);
    expect(occurrences.map((occurrence) => occurrence.originalStart)).toEqual([
      '2026-10-12T18:00:00',
      '2026-10-19T18:00:00',
      '2026-10-26T18:00:00',
      '2026-11-02T18:00:00',
      '2026-11-09T18:00:00',
    ]);
    // Vienna leaves DST on 2026-10-25: 18:00 wall time is 16:00Z before and 17:00Z after.
    expect(occurrences[0].startUtc).toBe('2026-10-12T16:00:00Z');
    expect(occurrences[2].startUtc).toBe('2026-10-26T17:00:00Z');
    expect(occurrences[0].endUtc).toBe('2026-10-12T18:00:00Z');
  });

  it('gives every generated row a source-scoped identity of series and original start', () => {
    const { occurrences } = materializeAppItem(item(), [], context());

    expect(occurrences[0].id).toBe('app:series-1#2026-10-12T18:00:00');
    expect(occurrences[0].seriesId).toBe('series-1');
    expect(occurrences[0].provenance).toBe('generated');
    expect(occurrences[0].itemKind).toBe('event');
  });

  it('materializes a standalone item as exactly one row without series identity', () => {
    const standalone = item({ rrule: null });

    const { occurrences } = materializeAppItem(standalone, [], context());

    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].id).toBe('app:series-1');
    expect(occurrences[0].seriesId).toBeNull();
    expect(occurrences[0].originalStart).toBeNull();
    expect(occurrences[0].provenance).toBe('standalone');
  });

  it('respects COUNT before the window ends', () => {
    const counted = item({ rrule: 'FREQ=WEEKLY;BYDAY=MO;COUNT=2' });

    const { occurrences } = materializeAppItem(counted, [], context());

    expect(occurrences).toHaveLength(2);
  });

  it('expands an all-day series on local days with exclusive UTC ends', () => {
    const allDay = item({
      start: { kind: 'date', value: '2026-10-24', timeZone: null },
      end: null,
      rrule: 'FREQ=DAILY;COUNT=3',
    });

    const { occurrences } = materializeAppItem(allDay, [], context());

    expect(occurrences.map((occurrence) => occurrence.startLocalDay)).toEqual([
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
    ]);
    expect(occurrences[0].isAllDay).toBe(true);
    expect(occurrences[0].endLocalDay).toBe('2026-10-24');
    // Midnight to midnight in Vienna; the 25th is the 25-hour DST day, so its exclusive end shifts.
    expect(occurrences[0].startUtc).toBe('2026-10-23T22:00:00Z');
    expect(occurrences[0].endUtc).toBe('2026-10-24T22:00:00Z');
    expect(occurrences[1].endUtc).toBe('2026-10-25T23:00:00Z');
  });

  it('spans a multi-day all-day event across its inclusive end date', () => {
    const camp = item({
      rrule: null,
      start: { kind: 'date', value: '2026-10-02', timeZone: null },
      end: { kind: 'date', value: '2026-10-04', timeZone: null },
    });

    const { occurrences } = materializeAppItem(camp, [], context());

    expect(occurrences[0].startLocalDay).toBe('2026-10-02');
    expect(occurrences[0].endLocalDay).toBe('2026-10-04');
    expect(occurrences[0].endUtc).toBe('2026-10-04T22:00:00Z');
  });

  it('drops cancelled occurrences and keeps the rest', () => {
    const cancelled = exception({ status: 'cancelled' });

    const { occurrences } = materializeAppItem(item(), [cancelled], context());

    expect(
      occurrences.some((occurrence) => occurrence.originalStart === '2026-10-19T18:00:00'),
    ).toBe(false);
    expect(occurrences).toHaveLength(4);
  });

  it('keeps the original identity when an override moves an occurrence, and carries the duration', () => {
    const moved = exception({
      start: { kind: 'zoned', value: '2026-10-21T09:00:00', timeZone: 'Europe/Vienna' },
    });

    const { occurrences } = materializeAppItem(item(), [moved], context());
    const overridden = occurrences.find(
      (occurrence) => occurrence.originalStart === '2026-10-19T18:00:00',
    );

    expect(overridden).toBeDefined();
    expect(overridden!.id).toBe('app:series-1#2026-10-19T18:00:00');
    expect(overridden!.provenance).toBe('overridden');
    expect(overridden!.start.value).toBe('2026-10-21T09:00:00');
    // The master's two hours carried over to the moved start.
    expect(overridden!.end?.value).toBe('2026-10-21T11:00:00');
  });

  it('applies field overrides without touching the time', () => {
    const renamed = exception({ title: 'Plenum (verschoben)', location: 'Jugendraum' });

    const { occurrences } = materializeAppItem(item(), [renamed], context());
    const overridden = occurrences.find(
      (occurrence) => occurrence.originalStart === '2026-10-19T18:00:00',
    );

    expect(overridden!.title).toBe('Plenum (verschoben)');
    expect(overridden!.location).toBe('Jugendraum');
    expect(overridden!.start.value).toBe('2026-10-19T18:00:00');
  });

  it('counts a timed event that crosses midnight into the next local day', () => {
    const late = item({
      rrule: null,
      start: { kind: 'zoned', value: '2026-10-02T22:00:00', timeZone: 'Europe/Vienna' },
      end: { kind: 'zoned', value: '2026-10-03T01:00:00', timeZone: 'Europe/Vienna' },
    });

    const { occurrences } = materializeAppItem(late, [], context());

    expect(occurrences[0].startLocalDay).toBe('2026-10-02');
    expect(occurrences[0].endLocalDay).toBe('2026-10-03');
  });

  it('does not count a timed event ending exactly at midnight into the next day', () => {
    const untilMidnight = item({
      rrule: null,
      start: { kind: 'zoned', value: '2026-10-02T22:00:00', timeZone: 'Europe/Vienna' },
      end: { kind: 'zoned', value: '2026-10-03T00:00:00', timeZone: 'Europe/Vienna' },
    });

    const { occurrences } = materializeAppItem(untilMidnight, [], context());

    expect(occurrences[0].endLocalDay).toBe('2026-10-02');
  });

  it('expands floating times in the device zone', () => {
    const floating = item({
      start: { kind: 'floating', value: '2026-10-12T08:00:00', timeZone: null },
      end: { kind: 'floating', value: '2026-10-12T08:30:00', timeZone: null },
      rrule: 'FREQ=DAILY;COUNT=1',
    });

    const { occurrences } = materializeAppItem(floating, [], context());

    expect(occurrences[0].start.kind).toBe('floating');
    expect(occurrences[0].startUtc).toBe('2026-10-12T06:00:00Z');
  });

  it('materializes an override whose original start is outside the window but whose moved start is inside it', () => {
    // 2026-11-23 is a Monday the rule generates, but it falls after the window end (Nov 15); the
    // override moves it to Nov 10, which is inside the window.
    const moved = exception({
      originalStart: '2026-11-23T18:00:00',
      start: { kind: 'zoned', value: '2026-11-10T09:00:00', timeZone: 'Europe/Vienna' },
    });

    const { occurrences } = materializeAppItem(item(), [moved], context());
    const materialized = occurrences.find(
      (occurrence) => occurrence.originalStart === '2026-11-23T18:00:00',
    );

    expect(materialized).toBeDefined();
    expect(materialized!.id).toBe('app:series-1#2026-11-23T18:00:00');
    expect(materialized!.provenance).toBe('overridden');
    expect(materialized!.start.value).toBe('2026-11-10T09:00:00');
  });

  it('does not resurrect a stale exception whose original start the rule no longer generates, even if moved into the window', () => {
    // Tuesday is not a day this weekly-Monday rule ever produces.
    const stale = exception({
      originalStart: '2026-11-24T18:00:00',
      start: { kind: 'zoned', value: '2026-11-10T09:00:00', timeZone: 'Europe/Vienna' },
    });

    const { occurrences } = materializeAppItem(item(), [stale], context());

    expect(
      occurrences.some((occurrence) => occurrence.originalStart === '2026-11-24T18:00:00'),
    ).toBe(false);
  });

  it('ignores a cancellation whose original start is outside the window', () => {
    const cancelledOutside = exception({
      originalStart: '2026-11-23T18:00:00',
      status: 'cancelled',
      start: null,
    });

    const { occurrences } = materializeAppItem(item(), [cancelledOutside], context());

    // Nothing to remove — the occurrence was never generated for this window in the first place.
    expect(
      occurrences.every((occurrence) => occurrence.originalStart !== '2026-11-23T18:00:00'),
    ).toBe(true);
  });

  it('truncates a series at the cap and reports it', () => {
    const daily = item({ rrule: 'FREQ=DAILY' });

    const { occurrences, truncated } = materializeAppItem(
      daily,
      [],
      context({ maxOccurrencesPerSeries: 5 }),
    );

    expect(truncated).toBe(true);
    expect(occurrences).toHaveLength(5);
  });
});
