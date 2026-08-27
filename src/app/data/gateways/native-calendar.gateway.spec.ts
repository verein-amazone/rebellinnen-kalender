import { TestBed } from '@angular/core/testing';
import type { CapacitorCalendar } from '@ebarooni/capacitor-calendar';

import { CAPACITOR_CALENDAR } from './capacitor-calendar';
import { NativeCalendarGateway } from './native-calendar.gateway';

function setup(plugin: Partial<typeof CapacitorCalendar>): NativeCalendarGateway {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: CAPACITOR_CALENDAR, useValue: plugin }],
  });

  return TestBed.inject(NativeCalendarGateway);
}

describe('NativeCalendarGateway', () => {
  it('maps unknown permission states to prompt and known ones through', async () => {
    const gateway = setup({
      checkPermission: async () => ({ result: 'prompt-with-rationale' as never }),
    });

    await expect(gateway.checkReadPermission()).resolves.toBe('prompt');
  });

  it('maps native calendars to plugin-free shapes with a safe writable default', async () => {
    const gateway = setup({
      listCalendars: async () => ({
        result: [
          { id: 'cal-1', title: 'Familie', color: '#ff0000', allowsContentModifications: null },
        ] as never,
      }),
    });

    await expect(gateway.listCalendars()).resolves.toEqual([
      {
        id: 'cal-1',
        name: 'Familie',
        color: '#ff0000',
        writable: false,
        sourceId: null,
        sourceName: null,
      },
    ]);
  });

  it('reads the native source from iOS’s `source` object', async () => {
    const gateway = setup({
      listCalendars: async () => ({
        result: [
          {
            id: 'cal-1',
            title: 'Familie',
            color: '#ff0000',
            allowsContentModifications: true,
            source: { id: 'icloud', title: 'iCloud' },
          },
        ] as never,
      }),
    });

    await expect(gateway.listCalendars()).resolves.toEqual([
      expect.objectContaining({ sourceId: 'icloud', sourceName: 'iCloud' }),
    ]);
  });

  it('falls back to Android’s `accountName` when there is no `source` object', async () => {
    const gateway = setup({
      listCalendars: async () => ({
        result: [
          {
            id: 'cal-1',
            title: 'Familie',
            color: '#ff0000',
            allowsContentModifications: true,
            accountName: 'user@gmail.com',
          },
        ] as never,
      }),
    });

    await expect(gateway.listCalendars()).resolves.toEqual([
      expect.objectContaining({ sourceId: 'user@gmail.com', sourceName: 'user@gmail.com' }),
    ]);
  });

  it('translates instance epochs to UTC instants without a fractional-second suffix', async () => {
    const gateway = setup({
      listEventsInRange: async (options: { from: number; to: number }) => {
        expect(options.from).toBe(Date.parse('2026-08-01T00:00:00Z'));
        expect(options.to).toBe(Date.parse('2026-08-31T00:00:00Z'));
        return {
          result: [
            {
              id: 'event-1',
              title: 'Zahnarzt',
              calendarId: 'cal-1',
              location: null,
              description: 'Kontrolle und Reinigung',
              startDate: Date.parse('2026-08-10T08:00:00Z'),
              endDate: Date.parse('2026-08-10T09:00:00Z'),
              isAllDay: false,
              timezone: 'Europe/Vienna',
            },
          ] as never,
        };
      },
    });

    const instances = await gateway.listEventInstances(
      '2026-08-01T00:00:00Z',
      '2026-08-31T00:00:00Z',
    );

    // `Date#toISOString()` would produce `…T08:00:00.000Z`; occurrence rows compare these strings
    // lexicographically against Temporal-formatted instants, which never carry the `.000` - the two
    // formats must match exactly or a device row's range boundary silently shifts.
    expect(instances).toEqual([
      {
        eventId: 'event-1',
        calendarId: 'cal-1',
        title: 'Zahnarzt',
        location: null,
        description: 'Kontrolle und Reinigung',
        startUtc: '2026-08-10T08:00:00Z',
        endUtc: '2026-08-10T09:00:00Z',
        isAllDay: false,
        timeZone: 'Europe/Vienna',
      },
    ]);
  });

  it('opens the system prompt to modify an event by id', async () => {
    let requestedId: string | undefined;
    const gateway = setup({
      modifyEventWithPrompt: async (options: { id: string }) => {
        requestedId = options.id;
        return { result: null as never };
      },
    });

    await gateway.openEventForEditing('event-1');

    expect(requestedId).toBe('event-1');
  });

  it('writes a new event straight into a device calendar with a default 15-minute alert', async () => {
    let sentOptions: unknown;
    const gateway = setup({
      createEvent: async (options: unknown) => {
        sentOptions = options;
        return { id: 'event-2' };
      },
    });

    const result = await gateway.createEvent({
      calendarId: 'cal-1',
      title: 'Plenum',
      location: 'Vereinsraum',
      startUtc: '2026-08-10T08:00:00Z',
      endUtc: '2026-08-10T09:00:00Z',
      isAllDay: false,
    });

    expect(result).toEqual({ eventId: 'event-2' });
    expect(sentOptions).toEqual({
      calendarId: 'cal-1',
      title: 'Plenum',
      location: 'Vereinsraum',
      startDate: Date.parse('2026-08-10T08:00:00Z'),
      endDate: Date.parse('2026-08-10T09:00:00Z'),
      isAllDay: false,
      alerts: [-15],
    });
  });

  it('sets no alert for an all-day device event', async () => {
    let sentOptions: unknown;
    const gateway = setup({
      createEvent: async (options: unknown) => {
        sentOptions = options;
        return { id: 'event-3' };
      },
    });

    await gateway.createEvent({
      calendarId: 'cal-1',
      title: 'Geburtstag',
      location: null,
      startUtc: '2026-08-10T00:00:00Z',
      endUtc: '2026-08-11T00:00:00Z',
      isAllDay: true,
    });

    expect(sentOptions).toEqual(expect.objectContaining({ isAllDay: true, alerts: undefined }));
  });
});
