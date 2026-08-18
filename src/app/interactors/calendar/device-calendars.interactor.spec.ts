import { TestBed } from '@angular/core/testing';

import { CalendarSourceDao } from '@app/data/daos/calendar-source.dao';
import { CAPACITOR_CALENDAR } from '@app/data/gateways/capacitor-calendar';
import { EmojiPickerGateway } from '@app/data/gateways/emoji-picker.gateway';
import { NATIVE_SETTINGS } from '@app/data/gateways/native-settings';
import { SQLITE_DATABASE } from '@app/data/gateways/sqlite-database';
import { InMemorySqliteDatabase } from '@app/data/gateways/sqlite-database.testing';
import { MIGRATIONS } from '@app/data/migrations/migrations';

import { DEVICE_SOURCE_ID } from './device-calendar-sync.interactor';
import { DeviceCalendarsInteractor } from './device-calendars.interactor';

class FakeEmojiPickerGateway {
  result: string | null = '🌻';

  pickEmoji(): Promise<string | null> {
    return Promise.resolve(this.result);
  }
}

describe('DeviceCalendarsInteractor', () => {
  let database: InMemorySqliteDatabase;
  let interactor: DeviceCalendarsInteractor;
  let sources: CalendarSourceDao;
  let emojiPicker: FakeEmojiPickerGateway;

  beforeEach(() => {
    database = new InMemorySqliteDatabase();
    database.migrate(MIGRATIONS);
    emojiPicker = new FakeEmojiPickerGateway();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: SQLITE_DATABASE, useValue: database },
        {
          provide: CAPACITOR_CALENDAR,
          useValue: {
            requestFullCalendarAccess: async () => ({ result: 'granted' }),
            checkPermission: async () => ({ result: 'granted' }),
            listCalendars: async () => ({ result: [] }),
            listEventsInRange: async () => ({ result: [] }),
          },
        },
        { provide: NATIVE_SETTINGS, useValue: {} },
        { provide: EmojiPickerGateway, useValue: emojiPicker },
      ],
    });

    interactor = TestBed.inject(DeviceCalendarsInteractor);
    sources = TestBed.inject(CalendarSourceDao);
  });

  afterEach(() => {
    database.close();
  });

  it('reports no source before the first connection', async () => {
    await expect(interactor.loadSnapshot()).resolves.toEqual({ source: null, groups: [] });
  });

  it('lists a connected source’s calendars', async () => {
    await interactor.connect();
    await sources.insertCalendar({
      id: 'device-cal:cal-1',
      sourceId: DEVICE_SOURCE_ID,
      name: 'Familie',
      color: '#ff0000',
      emoji: null,
      enabled: true,
      writable: true,
      externalId: 'cal-1',
      nativeSourceId: 'icloud',
      nativeSourceName: 'iCloud',
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });

    const snapshot = await interactor.loadSnapshot();

    expect(snapshot.source).toMatchObject({ id: DEVICE_SOURCE_ID, state: 'ok' });
    expect(snapshot.groups).toEqual([
      {
        nativeSourceId: 'icloud',
        nativeSourceName: 'iCloud',
        allEnabled: true,
        calendars: [
          {
            id: 'device-cal:cal-1',
            name: 'Familie',
            color: '#ff0000',
            emoji: null,
            enabled: true,
            writable: true,
          },
        ],
      },
    ]);
  });

  it('groups calendars with no reported native source into one fallback bucket', async () => {
    await interactor.connect();
    await sources.insertCalendar({
      id: 'device-cal:cal-1',
      sourceId: DEVICE_SOURCE_ID,
      name: 'Lokal 1',
      color: null,
      emoji: null,
      enabled: true,
      writable: true,
      externalId: 'cal-1',
      nativeSourceId: null,
      nativeSourceName: null,
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });
    await sources.insertCalendar({
      id: 'device-cal:cal-2',
      sourceId: DEVICE_SOURCE_ID,
      name: 'Lokal 2',
      color: null,
      emoji: null,
      enabled: true,
      writable: true,
      externalId: 'cal-2',
      nativeSourceId: null,
      nativeSourceName: null,
      createdAt: '2026-08-01T09:00:01.000Z',
      updatedAt: '2026-08-01T09:00:01.000Z',
    });

    const snapshot = await interactor.loadSnapshot();

    expect(snapshot.groups).toHaveLength(1);
    expect(snapshot.groups[0].nativeSourceId).toBeNull();
    expect(snapshot.groups[0].calendars).toHaveLength(2);
  });

  it('keeps two different accounts in separate groups', async () => {
    await interactor.connect();
    await sources.insertCalendar({
      id: 'device-cal:cal-1',
      sourceId: DEVICE_SOURCE_ID,
      name: 'Familie',
      color: null,
      emoji: null,
      enabled: true,
      writable: true,
      externalId: 'cal-1',
      nativeSourceId: 'icloud',
      nativeSourceName: 'iCloud',
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });
    await sources.insertCalendar({
      id: 'device-cal:cal-2',
      sourceId: DEVICE_SOURCE_ID,
      name: 'Arbeit',
      color: null,
      emoji: null,
      enabled: true,
      writable: true,
      externalId: 'cal-2',
      nativeSourceId: 'google',
      nativeSourceName: 'user@gmail.com',
      createdAt: '2026-08-01T09:00:01.000Z',
      updatedAt: '2026-08-01T09:00:01.000Z',
    });

    const snapshot = await interactor.loadSnapshot();

    expect(snapshot.groups.map((group) => group.nativeSourceId)).toEqual(['icloud', 'google']);
  });

  it('a group’s allEnabled is false once any of its calendars is disabled', async () => {
    await interactor.connect();
    await sources.insertCalendar({
      id: 'device-cal:cal-1',
      sourceId: DEVICE_SOURCE_ID,
      name: 'Familie',
      color: null,
      emoji: null,
      enabled: true,
      writable: true,
      externalId: 'cal-1',
      nativeSourceId: 'icloud',
      nativeSourceName: 'iCloud',
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });
    await sources.insertCalendar({
      id: 'device-cal:cal-2',
      sourceId: DEVICE_SOURCE_ID,
      name: 'Feiertage',
      color: null,
      emoji: null,
      enabled: false,
      writable: true,
      externalId: 'cal-2',
      nativeSourceId: 'icloud',
      nativeSourceName: 'iCloud',
      createdAt: '2026-08-01T09:00:01.000Z',
      updatedAt: '2026-08-01T09:00:01.000Z',
    });

    const snapshot = await interactor.loadSnapshot();

    expect(snapshot.groups[0].allEnabled).toBe(false);
  });

  it('enables and disables one calendar', async () => {
    await interactor.connect();
    await sources.insertCalendar({
      id: 'device-cal:cal-1',
      sourceId: DEVICE_SOURCE_ID,
      name: 'Familie',
      color: null,
      emoji: null,
      enabled: true,
      writable: true,
      externalId: 'cal-1',
      nativeSourceId: null,
      nativeSourceName: null,
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });

    await interactor.setCalendarEnabled('device-cal:cal-1', false);

    const snapshot = await interactor.loadSnapshot();
    expect(snapshot.groups[0].calendars[0].enabled).toBe(false);
  });

  it('enables or disables every calendar of one native source, leaving other sources untouched', async () => {
    await interactor.connect();
    await sources.insertCalendar({
      id: 'device-cal:cal-1',
      sourceId: DEVICE_SOURCE_ID,
      name: 'Familie',
      color: null,
      emoji: null,
      enabled: true,
      writable: true,
      externalId: 'cal-1',
      nativeSourceId: 'icloud',
      nativeSourceName: 'iCloud',
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });
    await sources.insertCalendar({
      id: 'device-cal:cal-2',
      sourceId: DEVICE_SOURCE_ID,
      name: 'Arbeit',
      color: null,
      emoji: null,
      enabled: true,
      writable: true,
      externalId: 'cal-2',
      nativeSourceId: 'google',
      nativeSourceName: 'user@gmail.com',
      createdAt: '2026-08-01T09:00:01.000Z',
      updatedAt: '2026-08-01T09:00:01.000Z',
    });

    await interactor.setCalendarsEnabledByNativeSource('icloud', false);

    const snapshot = await interactor.loadSnapshot();
    const icloud = snapshot.groups.find((group) => group.nativeSourceId === 'icloud');
    const google = snapshot.groups.find((group) => group.nativeSourceId === 'google');
    expect(icloud?.calendars.every((calendar) => !calendar.enabled)).toBe(true);
    expect(google?.calendars.every((calendar) => calendar.enabled)).toBe(true);
  });

  it('changes one calendar’s emoji, leaving its name and colour alone', async () => {
    await interactor.connect();
    await sources.insertCalendar({
      id: 'device-cal:cal-1',
      sourceId: DEVICE_SOURCE_ID,
      name: 'Familie',
      color: '#ff0000',
      emoji: null,
      enabled: true,
      writable: true,
      externalId: 'cal-1',
      nativeSourceId: null,
      nativeSourceName: null,
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });

    await interactor.setCalendarEmoji('device-cal:cal-1', '🌻');

    const snapshot = await interactor.loadSnapshot();
    expect(snapshot.groups[0].calendars[0]).toMatchObject({
      name: 'Familie',
      color: '#ff0000',
      emoji: '🌻',
    });
  });

  it('resolves the emoji the picker returns', async () => {
    emojiPicker.result = '🌻';

    await expect(interactor.pickEmoji()).resolves.toBe('🌻');
  });

  it('resolves null when the picker is dismissed without a selection', async () => {
    emojiPicker.result = null;

    await expect(interactor.pickEmoji()).resolves.toBeNull();
  });

  it('disconnecting disables the source and its calendars locally', async () => {
    await interactor.connect();
    await sources.insertCalendar({
      id: 'device-cal:cal-1',
      sourceId: DEVICE_SOURCE_ID,
      name: 'Familie',
      color: null,
      emoji: null,
      enabled: true,
      writable: true,
      externalId: 'cal-1',
      nativeSourceId: null,
      nativeSourceName: null,
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });

    await interactor.disconnect();

    const snapshot = await interactor.loadSnapshot();
    expect(snapshot.source?.enabled).toBe(false);
    expect(snapshot.groups[0].calendars[0].enabled).toBe(false);
  });
});
