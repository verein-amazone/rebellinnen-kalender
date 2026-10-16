import type { TemporalValue } from '../../entities/temporal-value';
import {
  parseRecurrenceRule,
  rebaseRecurrenceRule,
  serializeRecurrenceRule,
  weekdayOf,
  type RecurrenceRule,
} from './recurrence-rule';

const ZONE = 'Europe/Vienna';
// Monday, 12 October 2026, 18:00 in Vienna (16:00Z).
const ZONED_START: TemporalValue = { kind: 'zoned', value: '2026-10-12T18:00:00', timeZone: ZONE };
const DATE_START: TemporalValue = { kind: 'date', value: '2026-10-12', timeZone: null };

function rule(overrides: Partial<RecurrenceRule> = {}): RecurrenceRule {
  return { frequency: 'weekly', interval: 1, weekdays: [], end: { kind: 'never' }, ...overrides };
}

describe('weekdayOf', () => {
  it('names the weekday of a day', () => {
    expect(weekdayOf('2026-10-12')).toBe('MO');
    expect(weekdayOf('2026-10-18')).toBe('SU');
  });
});

describe('serializeRecurrenceRule', () => {
  it('writes a plain weekly rule with the start weekday', () => {
    expect(serializeRecurrenceRule(rule(), ZONED_START, ZONE)).toBe('FREQ=WEEKLY;BYDAY=MO');
  });

  it('always includes the start weekday and orders weekdays Monday first', () => {
    expect(serializeRecurrenceRule(rule({ weekdays: ['FR', 'WE'] }), ZONED_START, ZONE)).toBe(
      'FREQ=WEEKLY;BYDAY=MO,WE,FR',
    );
  });

  it('writes an interval only above 1', () => {
    expect(
      serializeRecurrenceRule(rule({ frequency: 'daily', interval: 2 }), ZONED_START, ZONE),
    ).toBe('FREQ=DAILY;INTERVAL=2');
    expect(serializeRecurrenceRule(rule({ frequency: 'monthly' }), ZONED_START, ZONE)).toBe(
      'FREQ=MONTHLY',
    );
  });

  it('ignores weekdays for anything but a weekly rule', () => {
    expect(
      serializeRecurrenceRule(rule({ frequency: 'yearly', weekdays: ['TU'] }), DATE_START, ZONE),
    ).toBe('FREQ=YEARLY');
  });

  it('writes COUNT', () => {
    expect(
      serializeRecurrenceRule(rule({ end: { kind: 'count', count: 10 } }), ZONED_START, ZONE),
    ).toBe('FREQ=WEEKLY;COUNT=10;BYDAY=MO');
  });

  it('writes UNTIL as the last second of the chosen day in the start zone, in UTC', () => {
    expect(
      serializeRecurrenceRule(
        rule({ end: { kind: 'until', date: '2026-12-31' } }),
        ZONED_START,
        ZONE,
      ),
    ).toBe('FREQ=WEEKLY;BYDAY=MO;UNTIL=20261231T225959Z');
  });

  it('writes UNTIL as a date for an all-day series', () => {
    expect(
      serializeRecurrenceRule(
        rule({ frequency: 'daily', end: { kind: 'until', date: '2026-12-31' } }),
        DATE_START,
        ZONE,
      ),
    ).toBe('FREQ=DAILY;UNTIL=20261231');
  });
});

describe('parseRecurrenceRule', () => {
  it('round-trips every rule the form can author', () => {
    const rules: RecurrenceRule[] = [
      rule({ weekdays: ['MO'] }),
      rule({ weekdays: ['MO', 'WE', 'FR'], interval: 2, end: { kind: 'count', count: 6 } }),
      rule({ frequency: 'daily', interval: 3 }),
      rule({ frequency: 'monthly', end: { kind: 'until', date: '2027-03-01' } }),
      rule({ frequency: 'yearly', interval: 1 }),
    ];

    for (const original of rules) {
      const stored = serializeRecurrenceRule(original, ZONED_START, ZONE);
      expect(parseRecurrenceRule(stored, ZONED_START, ZONE)).toEqual(original);
    }
  });

  it('reads an UNTIL date back for an all-day series', () => {
    expect(parseRecurrenceRule('FREQ=DAILY;UNTIL=20261231', DATE_START, ZONE)).toEqual(
      rule({ frequency: 'daily', end: { kind: 'until', date: '2026-12-31' } }),
    );
  });

  it('accepts an RRULE: prefix and a Monday week start', () => {
    expect(parseRecurrenceRule('RRULE:FREQ=WEEKLY;WKST=MO;BYDAY=TU', ZONED_START, ZONE)).toEqual(
      rule({ weekdays: ['TU'] }),
    );
  });

  it.each([
    'FREQ=MONTHLY;BYDAY=2TU',
    'FREQ=MONTHLY;BYSETPOS=-1;BYDAY=MO,TU,WE,TH,FR',
    'FREQ=MONTHLY;BYMONTHDAY=1,15',
    'FREQ=YEARLY;BYMONTH=3',
    'FREQ=HOURLY',
    'FREQ=MONTHLY;BYDAY=MO',
    'FREQ=WEEKLY;WKST=SU',
    'INTERVAL=2',
    'FREQ=WEEKLY;COUNT=0',
  ])('reports %s as unsupported', (stored) => {
    expect(parseRecurrenceRule(stored, ZONED_START, ZONE)).toBeNull();
  });
});

describe('rebaseRecurrenceRule', () => {
  // Tuesday, 13 October 2026.
  const NEXT_DAY: TemporalValue = { kind: 'zoned', value: '2026-10-13T18:00:00', timeZone: ZONE };

  it('moves weekly weekdays along with the start', () => {
    expect(rebaseRecurrenceRule('FREQ=WEEKLY;BYDAY=MO,TH', ZONED_START, NEXT_DAY, ZONE)).toBe(
      'FREQ=WEEKLY;BYDAY=TU,FR',
    );
    expect(
      rebaseRecurrenceRule(
        'FREQ=WEEKLY;BYDAY=MO,SU',
        ZONED_START,
        { kind: 'zoned', value: '2026-10-11T18:00:00', timeZone: ZONE },
        ZONE,
      ),
    ).toBe('FREQ=WEEKLY;BYDAY=SA,SU');
  });

  it('adds the start weekday to a rule anchored on another day', () => {
    expect(rebaseRecurrenceRule('FREQ=WEEKLY;BYDAY=MO', NEXT_DAY, NEXT_DAY, ZONE)).toBe(
      'FREQ=WEEKLY;BYDAY=MO,TU',
    );
  });

  it('rewrites UNTIL for a switch between all-day and timed', () => {
    expect(rebaseRecurrenceRule('FREQ=DAILY;UNTIL=20261231', DATE_START, ZONED_START, ZONE)).toBe(
      'FREQ=DAILY;UNTIL=20261231T225959Z',
    );
    expect(
      rebaseRecurrenceRule('FREQ=DAILY;UNTIL=20261231T225959Z', ZONED_START, DATE_START, ZONE),
    ).toBe('FREQ=DAILY;UNTIL=20261231');
  });

  it('leaves a rule the form cannot represent alone', () => {
    expect(rebaseRecurrenceRule('FREQ=MONTHLY;BYDAY=2TU', ZONED_START, NEXT_DAY, ZONE)).toBe(
      'FREQ=MONTHLY;BYDAY=2TU',
    );
  });
});
