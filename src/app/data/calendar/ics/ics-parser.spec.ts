import { IcsParseError, MAX_ICS_EVENTS, parseIcsCalendar } from './ics-parser';

const VIENNA_TIMEZONE = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Vienna',
  'BEGIN:STANDARD',
  'DTSTART:19701025T030000',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'BEGIN:DAYLIGHT',
  'DTSTART:19700329T020000',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'END:VTIMEZONE',
];

function calendar(lines: readonly string[]): string {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//DE', ...lines, 'END:VCALENDAR'].join(
    '\r\n',
  );
}

describe('parseIcsCalendar', () => {
  it('normalizes a recurring master with EXDATE and an override', () => {
    const text = calendar([
      ...VIENNA_TIMEZONE,
      'BEGIN:VEVENT',
      'UID:plenum@verein',
      'SUMMARY:Plenum',
      'LOCATION:Vereinslokal',
      'DTSTART;TZID=Europe/Vienna:20261012T180000',
      'DTEND;TZID=Europe/Vienna:20261012T200000',
      'RRULE:FREQ=WEEKLY;BYDAY=MO',
      'EXDATE;TZID=Europe/Vienna:20261019T180000',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:plenum@verein',
      'RECURRENCE-ID;TZID=Europe/Vienna:20261026T180000',
      'SUMMARY:Plenum (verschoben)',
      'DTSTART;TZID=Europe/Vienna:20261027T090000',
      'DTEND;TZID=Europe/Vienna:20261027T110000',
      'END:VEVENT',
    ]);

    const parsed = parseIcsCalendar(text, 'sub-1', 'rev-1');

    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]).toMatchObject({
      uid: 'plenum@verein',
      title: 'Plenum',
      rrule: 'FREQ=WEEKLY;BYDAY=MO',
      start: { kind: 'zoned', value: '2026-10-12T18:00:00', timeZone: 'Europe/Vienna' },
    });

    expect(parsed.exceptions).toHaveLength(2);
    const cancelled = parsed.exceptions.find((entry) => entry.status === 'cancelled');
    const override = parsed.exceptions.find((entry) => entry.status === 'override');
    expect(cancelled?.originalStart).toBe('2026-10-19T18:00:00');
    expect(override?.originalStart).toBe('2026-10-26T18:00:00');
    expect(override?.title).toBe('Plenum (verschoben)');
    expect(override?.start?.value).toBe('2026-10-27T09:00:00');
  });

  it('turns the exclusive DTEND of an all-day event into an inclusive last day', () => {
    const text = calendar([
      'BEGIN:VEVENT',
      'UID:fest@verein',
      'SUMMARY:Fest',
      'DTSTART;VALUE=DATE:20261101',
      'DTEND;VALUE=DATE:20261103',
      'END:VEVENT',
    ]);

    const parsed = parseIcsCalendar(text, 'sub-1', 'rev-1');

    expect(parsed.items[0].start).toEqual({ kind: 'date', value: '2026-11-01', timeZone: null });
    expect(parsed.items[0].end).toEqual({ kind: 'date', value: '2026-11-02', timeZone: null });
  });

  it('normalizes a UTC DTSTART to the canonical, millisecond-free instant format', () => {
    const text = calendar([
      'BEGIN:VEVENT',
      'UID:utc@verein',
      'SUMMARY:UTC-Termin',
      'DTSTART:20261012T170000Z',
      'END:VEVENT',
    ]);

    const parsed = parseIcsCalendar(text, 'sub-1', 'rev-1');

    // Occurrence rows compare UTC instants as strings; a `.000Z` suffix here would sort
    // differently than the Temporal-formatted instants the materializer produces.
    expect(parsed.items[0].start).toEqual({
      kind: 'utc',
      value: '2026-10-12T17:00:00Z',
      timeZone: null,
    });
  });

  it('falls back to floating time for an unknown TZID instead of failing the feed', () => {
    const text = calendar([
      'BEGIN:VEVENT',
      'UID:win@verein',
      'SUMMARY:Windows-Zeit',
      'DTSTART;TZID=W. Europe Standard Time:20261012T180000',
      'END:VEVENT',
    ]);

    const parsed = parseIcsCalendar(text, 'sub-1', 'rev-1');

    expect(parsed.items[0].start.kind).toBe('floating');
    expect(parsed.items[0].start.value).toBe('2026-10-12T18:00:00');
  });

  it('skips an unusable component, keeps the rest of the feed, and reports the skip', () => {
    const text = calendar([
      'BEGIN:VEVENT',
      'SUMMARY:No UID and no start',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:ok@verein',
      'SUMMARY:Stays',
      'DTSTART;VALUE=DATE:20261101',
      'END:VEVENT',
    ]);

    const parsed = parseIcsCalendar(text, 'sub-1', 'rev-1');

    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].uid).toBe('ok@verein');
    // Silently dropping unusable data would leave no trace it ever happened.
    expect(parsed.warnings).toHaveLength(1);
    expect(parsed.warnings[0]).toContain('without a UID');
  });

  it('names the skipped component by UID when it has one', () => {
    const text = calendar([
      'BEGIN:VEVENT',
      'UID:broken@verein',
      'SUMMARY:Broken',
      // No DTSTART — collectEvent throws for this component specifically.
      'END:VEVENT',
    ]);

    const parsed = parseIcsCalendar(text, 'sub-1', 'rev-1');

    expect(parsed.warnings).toHaveLength(1);
    expect(parsed.warnings[0]).toContain('broken@verein');
  });

  it('rejects a well-formed non-calendar component with the not-a-calendar code', () => {
    let caught: unknown;
    try {
      // Valid ICAL component syntax, but its top-level type is a vCard, not a calendar.
      parseIcsCalendar('BEGIN:VCARD\r\nVERSION:4.0\r\nEND:VCARD', 'sub-1', 'rev-1');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(IcsParseError);
    expect((caught as IcsParseError).code).toBe('not-a-calendar');
    expect((caught as IcsParseError).message).toBe('The file is not a calendar.');
  });

  it('rejects unparseable input with the unreadable code', () => {
    let caught: unknown;
    try {
      parseIcsCalendar('<html>not a calendar</html>', 'sub-1', 'rev-1');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(IcsParseError);
    expect((caught as IcsParseError).code).toBe('unreadable');
    expect((caught as IcsParseError).message).toBe('The calendar could not be read.');
  });

  it('rejects a feed over the event cap with the too-many-events code', () => {
    const events = Array.from(
      { length: MAX_ICS_EVENTS + 1 },
      (_, index) =>
        `BEGIN:VEVENT\r\nUID:event-${index}@verein\r\nDTSTART;VALUE=DATE:20261101\r\nEND:VEVENT`,
    ).join('\r\n');
    const text = calendar([events]);

    let caught: unknown;
    try {
      parseIcsCalendar(text, 'sub-1', 'rev-1');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(IcsParseError);
    expect((caught as IcsParseError).code).toBe('too-many-events');
  });

  it('reports no warnings for a clean feed', () => {
    const text = calendar([
      'BEGIN:VEVENT',
      'UID:ok@verein',
      'SUMMARY:Fine',
      'DTSTART;VALUE=DATE:20261101',
      'END:VEVENT',
    ]);

    expect(parseIcsCalendar(text, 'sub-1', 'rev-1').warnings).toEqual([]);
  });

  it('drops orphaned overrides whose master is missing', () => {
    const text = calendar([
      'BEGIN:VEVENT',
      'UID:orphan@verein',
      'RECURRENCE-ID:20261026T180000Z',
      'SUMMARY:Verwaist',
      'DTSTART:20261027T090000Z',
      'END:VEVENT',
    ]);

    const parsed = parseIcsCalendar(text, 'sub-1', 'rev-1');

    expect(parsed.items).toHaveLength(0);
    expect(parsed.exceptions).toHaveLength(0);
  });
});
