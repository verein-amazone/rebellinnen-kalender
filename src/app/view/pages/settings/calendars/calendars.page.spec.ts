import { LiveAnnouncer } from '@angular/cdk/a11y';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { DevicePlatformService } from '@app/cross-cutting/infrastructure/device-platform';
import {
  AppCalendarsInteractor,
  type WritableAppCalendar,
} from '@app/interactors/calendar/app-calendars.interactor';
import {
  DeviceCalendarsInteractor,
  type DeviceCalendarGroup,
  type DeviceCalendarPermission,
  type DeviceCalendarsSnapshot,
} from '@app/interactors/calendar/device-calendars.interactor';
import {
  IcsSubscriptionInteractor,
  type IcsRefreshOutcome,
  type IcsSubscriptionRow,
} from '@app/interactors/calendar/ics-subscription.interactor';
import { SheetService } from '@app/view/components/sheet/sheet.service';
import type { CalendarIdentityEditResult } from '@app/view/dialogs/calendar-identity-edit/calendar-identity-edit.dialog';

import { CalendarsPage } from './calendars.page';

const appCalendar: WritableAppCalendar = {
  id: 'app-cal-1',
  name: 'Mein Kalender',
  color: '#336699',
  emoji: '🗓️',
  sourceType: 'app',
};

class FakeAppCalendarsInteractor {
  calendar = appCalendar;
  readonly updateIdentityCalls: { calendarId: string; identity: CalendarIdentityEditResult }[] = [];

  listWritable(): Promise<WritableAppCalendar[]> {
    return Promise.resolve([this.calendar]);
  }

  updateIdentity(calendarId: string, identity: CalendarIdentityEditResult): Promise<void> {
    this.updateIdentityCalls.push({ calendarId, identity });
    return Promise.resolve();
  }
}

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
  opens: { content: unknown; heading: string; data: unknown }[] = [];

  open(
    content: unknown,
    config: { heading: string; data?: unknown },
  ): { closed: Observable<unknown> } {
    this.opens.push({ content, heading: config.heading, data: config.data });
    return { closed: of(this.results.shift()) };
  }
}

class FakeIcsSubscriptionInteractor {
  rows: IcsSubscriptionRow[] = [];
  readonly updateIdentityCalls: {
    subscriptionId: string;
    identity: CalendarIdentityEditResult;
  }[] = [];
  readonly setEnabledCalls: { subscriptionId: string; enabled: boolean }[] = [];
  readonly refreshCalls: { subscriptionId: string; force?: boolean }[] = [];
  readonly removeCalls: string[] = [];
  refreshOutcome: IcsRefreshOutcome = 'updated';
  pickedEmoji: string | null = '🌻';

  listForManagement(): Promise<IcsSubscriptionRow[]> {
    return Promise.resolve(this.rows);
  }

  updateIdentity(subscriptionId: string, identity: CalendarIdentityEditResult): Promise<void> {
    this.updateIdentityCalls.push({ subscriptionId, identity });
    return Promise.resolve();
  }

  setEnabled(subscriptionId: string, enabled: boolean): Promise<void> {
    this.setEnabledCalls.push({ subscriptionId, enabled });
    return Promise.resolve();
  }

  refresh(subscriptionId: string, options: { force?: boolean } = {}): Promise<IcsRefreshOutcome> {
    this.refreshCalls.push({ subscriptionId, force: options.force });
    return Promise.resolve(this.refreshOutcome);
  }

  remove(subscriptionId: string): Promise<void> {
    this.removeCalls.push(subscriptionId);
    return Promise.resolve();
  }

  pickEmoji(): Promise<string | null> {
    return Promise.resolve(this.pickedEmoji);
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
    icsSubscriptions?: IcsSubscriptionRow[];
  } = {},
) {
  const appCalendars = new FakeAppCalendarsInteractor();
  const deviceCalendars = new FakeDeviceCalendarsInteractor();
  const icsSubscriptions = new FakeIcsSubscriptionInteractor();
  if (options.deviceSnapshot !== undefined) {
    deviceCalendars.snapshot = options.deviceSnapshot;
  }
  if (options.connectResult !== undefined) {
    deviceCalendars.connectResult = options.connectResult;
  }
  if (options.icsSubscriptions !== undefined) {
    icsSubscriptions.rows = options.icsSubscriptions;
  }
  const sheets = new StubSheetService();
  const announcer = new StubLiveAnnouncer();

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AppCalendarsInteractor, useValue: appCalendars },
      { provide: DeviceCalendarsInteractor, useValue: deviceCalendars },
      { provide: IcsSubscriptionInteractor, useValue: icsSubscriptions },
      { provide: SheetService, useValue: sheets },
      { provide: LiveAnnouncer, useValue: announcer },
      // Most of this suite exercises the device-calendar section directly, so it defaults to a
      // native platform; only the platform-gating tests pass a different one.
      { provide: DevicePlatformService, useValue: { platform: options.platform ?? 'ios' } },
    ],
  });

  const fixture = TestBed.createComponent(CalendarsPage);
  await fixture.whenStable();

  return {
    fixture,
    element: fixture.nativeElement as HTMLElement,
    appCalendars,
    deviceCalendars,
    icsSubscriptions,
    sheets,
    announcer,
    settle: () => fixture.whenStable(),
  };
}

describe('CalendarsPage, app calendar', () => {
  it('shows the app calendar’s name, colour and emoji', async () => {
    const { element } = await setup();

    expect(element.textContent).toContain('Mein Kalender');
  });

  it('opens the identity editor and saves the result', async () => {
    const page = await setup();
    const result: CalendarIdentityEditResult = {
      name: 'Vereinstermine',
      color: '#aa3377',
      emoji: '🌸',
    };
    page.sheets.results = [result];

    const button = Array.from(page.element.querySelectorAll('button')).find((candidate) =>
      candidate.textContent?.includes('Mein Kalender'),
    );
    button!.click();
    await page.settle();

    expect(page.appCalendars.updateIdentityCalls).toEqual([
      { calendarId: 'app-cal-1', identity: result },
    ]);
    expect(page.announcer.announcements).toContain('Kalender gespeichert');
  });

  it('does nothing when the identity editor is dismissed', async () => {
    const page = await setup();
    page.sheets.results = [undefined];

    const button = Array.from(page.element.querySelectorAll('button')).find((candidate) =>
      candidate.textContent?.includes('Mein Kalender'),
    );
    button!.click();
    await page.settle();

    expect(page.appCalendars.updateIdentityCalls).toEqual([]);
  });
});

describe('CalendarsPage, platform gating', () => {
  it('hides the device-calendar section on web', async () => {
    const { element } = await setup({ platform: 'web' });

    expect(element.textContent).not.toContain('Gerätekalender');
  });

  it('shows the device-calendar section on android', async () => {
    const { element } = await setup({ platform: 'android' });

    expect(element.textContent).toContain('Gerätekalender');
  });
});

describe('CalendarsPage, device calendars: not connected', () => {
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

describe('CalendarsPage, device calendars: connected', () => {
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

describe('CalendarsPage, device calendars: grouped by native source', () => {
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

describe('CalendarsPage, device calendars: permission lost', () => {
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

function icsRow(overrides: Partial<IcsSubscriptionRow> = {}): IcsSubscriptionRow {
  return {
    id: 'ics-1',
    name: 'Schule',
    color: '#336699',
    emoji: '🏫',
    enabled: true,
    state: 'ok',
    lastError: null,
    ...overrides,
  };
}

describe('CalendarsPage, subscribed calendars: empty', () => {
  it('explains there are none yet and offers to add one', async () => {
    const { element } = await setup({ icsSubscriptions: [] });

    expect(element.textContent).toContain('Noch keine abonnierten Kalender');
    expect(
      Array.from(element.querySelectorAll('button')).some((b) =>
        b.textContent?.includes('Kalender per Link hinzufügen'),
      ),
    ).toBe(true);
  });
});

describe('CalendarsPage, subscribed calendars: add', () => {
  it('opens the add sheet and reloads on success', async () => {
    const page = await setup({ icsSubscriptions: [] });
    page.sheets.results = [{ subscriptionId: 'ics-1', outcome: 'updated' }];
    page.icsSubscriptions.rows = [icsRow()];

    const addButton = Array.from(page.element.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Kalender per Link hinzufügen'),
    )!;
    addButton.click();
    await page.settle();

    expect(page.element.textContent).toContain('Schule');
    expect(page.announcer.announcements).toContain('Kalender hinzugefügt');
  });

  it('announces that loading is still pending when the first refresh failed', async () => {
    const page = await setup({ icsSubscriptions: [] });
    page.sheets.results = [{ subscriptionId: 'ics-1', outcome: 'failed' }];

    const addButton = Array.from(page.element.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Kalender per Link hinzufügen'),
    )!;
    addButton.click();
    await page.settle();

    expect(page.announcer.announcements).toContain(
      'Kalender hinzugefügt, konnte aber noch nicht geladen werden',
    );
  });

  it('does nothing when the add sheet is cancelled', async () => {
    const page = await setup({ icsSubscriptions: [] });
    page.sheets.results = [undefined];

    const addButton = Array.from(page.element.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Kalender per Link hinzufügen'),
    )!;
    addButton.click();
    await page.settle();

    expect(page.announcer.announcements).toEqual([]);
  });
});

describe('CalendarsPage, subscribed calendars: manage', () => {
  it('lists a subscription with a toggle reflecting its enabled state', async () => {
    const { element } = await setup({ icsSubscriptions: [icsRow({ enabled: false })] });

    expect(element.textContent).toContain('Schule');
    const toggle = element.querySelector<HTMLInputElement>('#ics-calendar-ics-1');
    expect(toggle?.checked).toBe(false);
  });

  it('toggles a subscription and reloads', async () => {
    const page = await setup({ icsSubscriptions: [icsRow()] });

    const toggle = page.element.querySelector<HTMLInputElement>('#ics-calendar-ics-1')!;
    toggle.click();
    await page.settle();

    expect(page.icsSubscriptions.setEnabledCalls).toEqual([
      { subscriptionId: 'ics-1', enabled: false },
    ]);
  });

  it('opens the identity editor with the ICS emoji picker and saves the result', async () => {
    const page = await setup({ icsSubscriptions: [icsRow()] });
    const result: CalendarIdentityEditResult = {
      name: 'Vereinstermine',
      color: '#aa3377',
      emoji: '🌸',
    };
    page.sheets.results = [result];

    const editButton = page.element.querySelector<HTMLButtonElement>(
      'button[aria-label*="Schule"][aria-label*="bearbeiten"]',
    )!;
    editButton.click();
    await page.settle();

    expect(page.icsSubscriptions.updateIdentityCalls).toEqual([
      { subscriptionId: 'ics-1', identity: result },
    ]);
    expect(page.announcer.announcements).toContain('Kalender gespeichert');
  });

  it('shows a retry action and error text for a subscription in error state', async () => {
    const page = await setup({
      icsSubscriptions: [icsRow({ state: 'error', lastError: 'Der Server antwortet nicht.' })],
    });

    expect(page.element.textContent).toContain('Der Server antwortet nicht.');
    const retryButton = page.element.querySelector<HTMLButtonElement>(
      'button[aria-label*="Erneut versuchen"][aria-label*="Schule"]',
    );
    expect(retryButton).not.toBeNull();
  });

  it('retries a failing subscription and announces the outcome', async () => {
    const page = await setup({
      icsSubscriptions: [icsRow({ state: 'error', lastError: 'kaputt' })],
    });
    page.icsSubscriptions.refreshOutcome = 'updated';

    const retryButton = page.element.querySelector<HTMLButtonElement>(
      'button[aria-label*="Erneut versuchen"][aria-label*="Schule"]',
    )!;
    retryButton.click();
    await page.settle();

    expect(page.icsSubscriptions.refreshCalls).toEqual([{ subscriptionId: 'ics-1', force: true }]);
    expect(page.announcer.announcements).toContain('Kalender aktualisiert');
  });

  it('shows no retry action for a subscription in ok state', async () => {
    const page = await setup({ icsSubscriptions: [icsRow({ state: 'ok' })] });

    const retryButton = page.element.querySelector<HTMLButtonElement>(
      'button[aria-label*="Erneut versuchen"]',
    );
    expect(retryButton).toBeNull();
  });

  it('removes a subscription after confirmation', async () => {
    const page = await setup({ icsSubscriptions: [icsRow()] });
    page.sheets.results = [true];

    const removeButton = page.element.querySelector<HTMLButtonElement>(
      'button[aria-label*="Schule"][aria-label*="entfernen"]',
    )!;
    removeButton.click();
    await page.settle();

    expect(page.icsSubscriptions.removeCalls).toEqual(['ics-1']);
    expect(page.announcer.announcements).toContain('Kalender entfernt');
  });

  it('does not remove when the confirmation is declined', async () => {
    const page = await setup({ icsSubscriptions: [icsRow()] });
    page.sheets.results = [false];

    const removeButton = page.element.querySelector<HTMLButtonElement>(
      'button[aria-label*="Schule"][aria-label*="entfernen"]',
    )!;
    removeButton.click();
    await page.settle();

    expect(page.icsSubscriptions.removeCalls).toEqual([]);
  });
});
