import { LiveAnnouncer } from '@angular/cdk/a11y';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { DevicePlatformService } from '@app/cross-cutting/infrastructure/device-platform';
import {
  DeviceCalendarsInteractor,
  type DeviceCalendarGroup,
  type DeviceCalendarPermission,
  type DeviceCalendarsSnapshot,
} from '@app/interactors/calendar/device-calendars.interactor';
import { SheetService } from '@app/view/components/sheet/sheet.service';

import { DeviceCalendarsPage } from './device-calendars.page';

class FakeDeviceCalendarsInteractor {
  snapshot: DeviceCalendarsSnapshot = { source: null, groups: [] };
  connectResult: DeviceCalendarPermission = 'granted';
  readonly setEnabledCalls: { calendarId: string; enabled: boolean }[] = [];
  readonly setGroupEnabledCalls: { nativeSourceId: string | null; enabled: boolean }[] = [];
  disconnectCalled = false;
  openSettingsCalled = false;

  loadSnapshot(): Promise<DeviceCalendarsSnapshot> {
    return Promise.resolve(this.snapshot);
  }

  connect(): Promise<DeviceCalendarPermission> {
    return Promise.resolve(this.connectResult);
  }

  setCalendarEnabled(calendarId: string, enabled: boolean): Promise<void> {
    this.setEnabledCalls.push({ calendarId, enabled });
    return Promise.resolve();
  }

  setCalendarsEnabledByNativeSource(
    nativeSourceId: string | null,
    enabled: boolean,
  ): Promise<void> {
    this.setGroupEnabledCalls.push({ nativeSourceId, enabled });
    return Promise.resolve();
  }

  pickedEmoji: string | null = '🌻';
  readonly setEmojiCalls: { calendarId: string; emoji: string }[] = [];

  pickEmoji(): Promise<string | null> {
    return Promise.resolve(this.pickedEmoji);
  }

  setCalendarEmoji(calendarId: string, emoji: string): Promise<void> {
    this.setEmojiCalls.push({ calendarId, emoji });
    return Promise.resolve();
  }

  disconnect(): Promise<void> {
    this.disconnectCalled = true;
    return Promise.resolve();
  }

  openAppSettings(): Promise<void> {
    this.openSettingsCalled = true;
    return Promise.resolve();
  }
}

class StubSheetService {
  results: unknown[] = [];

  open(): { closed: Observable<unknown> } {
    return { closed: of(this.results.shift()) };
  }
}

class StubLiveAnnouncer {
  readonly announcements: string[] = [];

  announce(message: string): Promise<void> {
    this.announcements.push(message);
    return Promise.resolve();
  }
}

async function setup(
  options: {
    deviceSnapshot?: DeviceCalendarsSnapshot;
    connectResult?: DeviceCalendarPermission;
    platform?: 'ios' | 'android' | 'web';
  } = {},
) {
  const deviceCalendars = new FakeDeviceCalendarsInteractor();
  if (options.deviceSnapshot !== undefined) {
    deviceCalendars.snapshot = options.deviceSnapshot;
  }
  if (options.connectResult !== undefined) {
    deviceCalendars.connectResult = options.connectResult;
  }
  const sheets = new StubSheetService();
  const announcer = new StubLiveAnnouncer();

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: DeviceCalendarsInteractor, useValue: deviceCalendars },
      { provide: SheetService, useValue: sheets },
      { provide: LiveAnnouncer, useValue: announcer },
      // This suite exercises the device-calendar flow directly, so it defaults to a native
      // platform; only the platform-gating test passes a different one.
      { provide: DevicePlatformService, useValue: { platform: options.platform ?? 'ios' } },
    ],
  });

  const fixture = TestBed.createComponent(DeviceCalendarsPage);
  await fixture.whenStable();

  return {
    fixture,
    element: fixture.nativeElement as HTMLElement,
    deviceCalendars,
    sheets,
    announcer,
    settle: () => fixture.whenStable(),
  };
}

describe('DeviceCalendarsPage, platform gating', () => {
  it('explains device calendars are unavailable on web', async () => {
    const { element } = await setup({ platform: 'web' });

    expect(element.textContent).toContain('im Web nicht verfügbar');
  });
});

describe('DeviceCalendarsPage, not connected', () => {
  it('explains the connection before any device source exists', async () => {
    const { element } = await setup();

    expect(element.textContent).toContain('Verbinde die Kalender deines Geräts');
  });

  it('connects and announces success on grant', async () => {
    const page = await setup({ connectResult: 'granted' });

    const button = Array.from(page.element.querySelectorAll('button')).find((candidate) =>
      candidate.textContent?.includes('Gerätekalender verbinden'),
    );
    button!.click();
    await page.settle();

    expect(page.announcer.announcements).toContain('Gerätekalender verbunden');
  });

  it('offers the system settings deep link after a denied permission', async () => {
    const page = await setup({ connectResult: 'denied' });

    const connectButton = Array.from(page.element.querySelectorAll('button')).find((candidate) =>
      candidate.textContent?.includes('Gerätekalender verbinden'),
    );
    connectButton!.click();
    await page.settle();

    expect(page.element.textContent).toContain('nicht erteilt');
    const settingsButton = Array.from(page.element.querySelectorAll('button')).find((candidate) =>
      candidate.textContent?.includes('Einstellungen öffnen'),
    );
    settingsButton!.click();
    await page.settle();

    expect(page.deviceCalendars.openSettingsCalled).toBe(true);
  });
});

function group(overrides: Partial<DeviceCalendarGroup> = {}): DeviceCalendarGroup {
  return {
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
    ...overrides,
  };
}

const deviceSource: DeviceCalendarsSnapshot['source'] = {
  id: 'device',
  type: 'device',
  name: 'Gerätekalender',
  enabled: true,
  state: 'ok',
  createdAt: '2026-08-01T09:00:00.000Z',
  updatedAt: '2026-08-01T09:00:00.000Z',
};

describe('DeviceCalendarsPage, connected', () => {
  const snapshot: DeviceCalendarsSnapshot = { source: deviceSource, groups: [group()] };

  it('shows the account name as a subheading and lists calendars with a toggle each', async () => {
    const { element } = await setup({ deviceSnapshot: snapshot });

    expect(element.textContent).toContain('iCloud');
    expect(element.textContent).toContain('Familie');
    expect(element.querySelector('input[type="checkbox"][role="switch"]')).not.toBeNull();
  });

  it('toggles a calendar off', async () => {
    const page = await setup({ deviceSnapshot: snapshot });

    const toggle = page.element.querySelector<HTMLInputElement>(
      'input[type="checkbox"][role="switch"]',
    )!;
    toggle.click();
    await page.settle();

    expect(page.deviceCalendars.setEnabledCalls).toEqual([
      { calendarId: 'device-cal:cal-1', enabled: false },
    ]);
  });

  it('opens the emoji picker from the avatar and saves the picked emoji', async () => {
    const page = await setup({ deviceSnapshot: snapshot });
    page.deviceCalendars.pickedEmoji = '🌻';

    const avatarButton = page.element.querySelector<HTMLButtonElement>(
      'button[aria-label*="Emoji"][aria-label*="Familie"]',
    )!;
    avatarButton.click();
    await page.settle();

    expect(page.deviceCalendars.setEmojiCalls).toEqual([
      { calendarId: 'device-cal:cal-1', emoji: '🌻' },
    ]);
  });

  it('leaves the emoji unchanged when the picker is dismissed without a selection', async () => {
    const page = await setup({ deviceSnapshot: snapshot });
    page.deviceCalendars.pickedEmoji = null;

    const avatarButton = page.element.querySelector<HTMLButtonElement>(
      'button[aria-label*="Emoji"][aria-label*="Familie"]',
    )!;
    avatarButton.click();
    await page.settle();

    expect(page.deviceCalendars.setEmojiCalls).toEqual([]);
  });

  it('disconnects after confirmation', async () => {
    const page = await setup({ deviceSnapshot: snapshot });
    page.sheets.results = [true];

    const disconnectButton = Array.from(page.element.querySelectorAll('button')).find((candidate) =>
      candidate.textContent?.includes('Verbindung trennen'),
    );
    disconnectButton!.click();
    await page.settle();

    expect(page.deviceCalendars.disconnectCalled).toBe(true);
    expect(page.announcer.announcements).toContain('Gerätekalender getrennt');
  });

  it('does not disconnect when the confirmation is declined', async () => {
    const page = await setup({ deviceSnapshot: snapshot });
    page.sheets.results = [false];

    const disconnectButton = Array.from(page.element.querySelectorAll('button')).find((candidate) =>
      candidate.textContent?.includes('Verbindung trennen'),
    );
    disconnectButton!.click();
    await page.settle();

    expect(page.deviceCalendars.disconnectCalled).toBe(false);
  });
});

describe('DeviceCalendarsPage, grouped by native source', () => {
  const twoAccounts: DeviceCalendarsSnapshot = {
    source: deviceSource,
    groups: [
      group({
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
          {
            id: 'device-cal:cal-2',
            name: 'Feiertage',
            color: '#00ff00',
            emoji: null,
            enabled: true,
            writable: false,
          },
        ],
      }),
      group({
        nativeSourceId: 'google',
        nativeSourceName: 'user@gmail.com',
        allEnabled: true,
        calendars: [
          {
            id: 'device-cal:cal-3',
            name: 'Arbeit',
            color: '#0000ff',
            emoji: null,
            enabled: true,
            writable: true,
          },
        ],
      }),
    ],
  };

  it('shows a subheading per native source', async () => {
    const { element } = await setup({ deviceSnapshot: twoAccounts });

    expect(element.textContent).toContain('iCloud');
    expect(element.textContent).toContain('user@gmail.com');
  });

  it('falls back to a generic label when a group has no reported native source', async () => {
    const { element } = await setup({
      deviceSnapshot: {
        source: deviceSource,
        groups: [group({ nativeSourceId: null, nativeSourceName: null })],
      },
    });

    expect(element.textContent).toContain('Weitere Kalender');
  });

  it('shows a "select all" toggle only for a group with more than one calendar', async () => {
    const { element } = await setup({ deviceSnapshot: twoAccounts });

    const toggles = element.querySelectorAll('#device-calendar-group-icloud');
    const soloGroupToggle = element.querySelector('#device-calendar-group-google');
    expect(toggles).toHaveLength(1);
    expect(soloGroupToggle).toBeNull();
  });

  it('reflects a group’s allEnabled as the "select all" toggle state', async () => {
    const { element } = await setup({
      deviceSnapshot: {
        source: deviceSource,
        groups: [
          group({
            allEnabled: false,
            calendars: [
              {
                id: 'device-cal:cal-1',
                name: 'Familie',
                color: null,
                emoji: null,
                enabled: true,
                writable: true,
              },
              {
                id: 'device-cal:cal-2',
                name: 'Feiertage',
                color: null,
                emoji: null,
                enabled: false,
                writable: true,
              },
            ],
          }),
        ],
      },
    });

    const toggle = element.querySelector<HTMLInputElement>('#device-calendar-group-icloud');
    expect(toggle?.checked).toBe(false);
  });

  it('toggling a group’s "select all" only affects that native source', async () => {
    const page = await setup({ deviceSnapshot: twoAccounts });

    const toggle = page.element.querySelector<HTMLInputElement>('#device-calendar-group-icloud')!;
    toggle.click();
    await page.settle();

    expect(page.deviceCalendars.setGroupEnabledCalls).toEqual([
      { nativeSourceId: 'icloud', enabled: false },
    ]);
  });
});

describe('DeviceCalendarsPage, permission lost', () => {
  it('offers the settings deep link while keeping cached calendars visible', async () => {
    const { element } = await setup({
      deviceSnapshot: {
        source: { ...deviceSource, state: 'permission-lost' },
        groups: [group()],
      },
    });

    expect(element.textContent).toContain('entzogen');
    expect(element.textContent).toContain('Familie');
  });
});
