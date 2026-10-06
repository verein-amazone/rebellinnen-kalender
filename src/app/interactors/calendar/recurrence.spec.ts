import { describeRecurrence, describeStoredRecurrence, type RecurrenceRule } from './recurrence';

function rule(overrides: Partial<RecurrenceRule> = {}): RecurrenceRule {
  return { frequency: 'weekly', interval: 1, weekdays: [], end: { kind: 'never' }, ...overrides };
}

// Monday, 12 October 2026.
const START_DAY = '2026-10-12';

describe('describeRecurrence', () => {
  it.each<[Partial<RecurrenceRule>, string]>([
    [{ frequency: 'daily' }, 'Jeden Tag'],
    [{ frequency: 'daily', interval: 3 }, 'Alle 3 Tage'],
    [{}, 'Jede Woche am Montag'],
    [{ weekdays: ['WE'] }, 'Jede Woche am Montag und Mittwoch'],
    [{ interval: 2, weekdays: ['FR', 'WE'] }, 'Alle 2 Wochen am Montag, Mittwoch und Freitag'],
    [{ frequency: 'monthly' }, 'Jeden Monat am 12.'],
    [{ frequency: 'monthly', interval: 3 }, 'Alle 3 Monate am 12.'],
    [{ frequency: 'yearly' }, 'Jedes Jahr am 12. Oktober'],
    [{ frequency: 'yearly', interval: 2 }, 'Alle 2 Jahre am 12. Oktober'],
  ])('describes %o as „%s“', (overrides, expected) => {
    expect(describeRecurrence(rule(overrides), START_DAY)).toBe(expected);
  });

  it('adds the end', () => {
    expect(
      describeRecurrence(rule({ end: { kind: 'until', date: '2026-12-31' } }), START_DAY),
    ).toBe('Jede Woche am Montag, bis 31. Dezember 2026');
    expect(describeRecurrence(rule({ end: { kind: 'count', count: 10 } }), START_DAY)).toBe(
      'Jede Woche am Montag, 10 Mal',
    );
    expect(describeRecurrence(rule({ end: { kind: 'count', count: 1 } }), START_DAY)).toBe(
      'Jede Woche am Montag, einmal',
    );
  });
});

describe('describeStoredRecurrence', () => {
  const start = { kind: 'zoned', value: '2026-10-12T18:00:00', timeZone: 'Europe/Vienna' } as const;

  it('describes a rule the form understands', () => {
    expect(describeStoredRecurrence('FREQ=WEEKLY;BYDAY=MO,TH', start)).toBe(
      'Jede Woche am Montag und Donnerstag',
    );
  });

  it('falls back to a neutral label for a rule it does not', () => {
    expect(describeStoredRecurrence('FREQ=MONTHLY;BYDAY=2TU', start)).toBe(
      'Wiederholt sich nach einer eigenen Regel',
    );
  });
});
