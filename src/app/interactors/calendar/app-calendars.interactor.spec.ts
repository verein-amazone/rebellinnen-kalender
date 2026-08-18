import { TestBed } from '@angular/core/testing';

import { CalendarSourceDao } from '@app/data/daos/calendar-source.dao';
import { EmojiPickerGateway } from '@app/data/gateways/emoji-picker.gateway';
import { SQLITE_DATABASE } from '@app/data/gateways/sqlite-database';
import { InMemorySqliteDatabase } from '@app/data/gateways/sqlite-database.testing';
import { MIGRATIONS } from '@app/data/migrations/migrations';
import { AppCalendarsInteractor } from './app-calendars.interactor';

class FakeEmojiPickerGateway {
  result: string | null = '🌻';

  pickEmoji(): Promise<string | null> {
    return Promise.resolve(this.result);
  }
}

describe('AppCalendarsInteractor', () => {
  let database: InMemorySqliteDatabase;
  let interactor: AppCalendarsInteractor;
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
        { provide: EmojiPickerGateway, useValue: emojiPicker },
      ],
    });

    interactor = TestBed.inject(AppCalendarsInteractor);
    sources = TestBed.inject(CalendarSourceDao);
  });

  afterEach(() => {
    database.close();
  });

  it('lists app calendars alongside enabled, writable device calendars', async () => {
    await sources.insertSource({
      id: 'app-source',
      type: 'app',
      name: 'App',
      enabled: true,
      state: 'ok',
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });
    await sources.insertCalendar({
      id: 'calendar-1',
      sourceId: 'app-source',
      name: 'Termine',
      color: '#aa3377',
      emoji: '🌸',
      enabled: true,
      writable: true,
      externalId: null,
      nativeSourceId: null,
      nativeSourceName: null,
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });

    await sources.insertSource({
      id: 'device-source',
      type: 'device',
      name: 'Gerätekalender',
      enabled: true,
      state: 'ok',
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });
    await sources.insertCalendar({
      id: 'device-cal:cal-1',
      sourceId: 'device-source',
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

    await expect(interactor.listWritable()).resolves.toEqual([
      { id: 'calendar-1', name: 'Termine', color: '#aa3377', emoji: '🌸', sourceType: 'app' },
      { id: 'device-cal:cal-1', name: 'Familie', color: null, emoji: null, sourceType: 'device' },
    ]);
  });

  it('excludes a read-only device calendar, a disabled one, and ICS calendars', async () => {
    await sources.insertSource({
      id: 'device-source',
      type: 'device',
      name: 'Gerätekalender',
      enabled: true,
      state: 'ok',
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });
    await sources.insertCalendar({
      id: 'device-cal:readonly',
      sourceId: 'device-source',
      name: 'Feiertage',
      color: null,
      emoji: null,
      enabled: true,
      writable: false,
      externalId: 'readonly',
      nativeSourceId: null,
      nativeSourceName: null,
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });
    await sources.insertCalendar({
      id: 'device-cal:disabled',
      sourceId: 'device-source',
      name: 'Arbeit',
      color: null,
      emoji: null,
      enabled: false,
      writable: true,
      externalId: 'disabled',
      nativeSourceId: null,
      nativeSourceName: null,
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });

    await sources.insertSource({
      id: 'ics-source',
      type: 'ics',
      name: 'Amazone',
      enabled: true,
      state: 'ok',
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });
    await sources.insertCalendar({
      id: 'ics-cal:sub-1',
      sourceId: 'ics-source',
      name: 'Amazone',
      color: null,
      emoji: null,
      enabled: true,
      writable: false,
      externalId: null,
      nativeSourceId: null,
      nativeSourceName: null,
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });

    // Only the "Mein Kalender" default remains, created lazily by `listWritable()` itself.
    const result = await interactor.listWritable();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ name: 'Mein Kalender', sourceType: 'app' });
  });

  it('excludes calendars of a disconnected (disabled) device source even if the calendar itself is enabled', async () => {
    await sources.insertSource({
      id: 'device-source',
      type: 'device',
      name: 'Gerätekalender',
      enabled: false,
      state: 'ok',
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });
    await sources.insertCalendar({
      id: 'device-cal:cal-1',
      sourceId: 'device-source',
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

    const result = await interactor.listWritable();
    expect(result.find((calendar) => calendar.sourceType === 'device')).toBeUndefined();
  });

  it('creates the app calendar on first run instead of returning an empty picker', async () => {
    const result = await interactor.listWritable();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ name: 'Mein Kalender', color: null, emoji: null });

    const allSources = await sources.listSources();
    expect(allSources.filter((source) => source.type === 'app')).toHaveLength(1);
  });

  it('does not create a second app calendar on a later call', async () => {
    await interactor.listWritable();
    await interactor.listWritable();

    const allSources = await sources.listSources();
    expect(allSources.filter((source) => source.type === 'app')).toHaveLength(1);
  });

  it('updates a calendar’s identity', async () => {
    await interactor.listWritable();
    const [calendar] = await sources.listCalendars();

    await interactor.updateIdentity(calendar.id, {
      name: 'Vereinstermine',
      color: '#336699',
      emoji: '🗓️',
    });

    const updated = await sources.findCalendar(calendar.id);
    expect(updated).toMatchObject({ name: 'Vereinstermine', color: '#336699', emoji: '🗓️' });
  });

  it('resolves the emoji the picker returns', async () => {
    emojiPicker.result = '🌻';

    await expect(interactor.pickEmoji()).resolves.toBe('🌻');
  });

  it('resolves null when the picker is dismissed without a selection', async () => {
    emojiPicker.result = null;

    await expect(interactor.pickEmoji()).resolves.toBeNull();
  });
});
