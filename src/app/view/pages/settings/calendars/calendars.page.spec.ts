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

async function setup(options: { platform?: 'ios' | 'android' | 'web' } = {}) {
  const appCalendars = new FakeAppCalendarsInteractor();
  const sheets = new StubSheetService();
  const announcer = new StubLiveAnnouncer();

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AppCalendarsInteractor, useValue: appCalendars },
      { provide: SheetService, useValue: sheets },
      { provide: LiveAnnouncer, useValue: announcer },
      { provide: DevicePlatformService, useValue: { platform: options.platform ?? 'ios' } },
    ],
  });

  const fixture = TestBed.createComponent(CalendarsPage);
  await fixture.whenStable();

  return {
    fixture,
    element: fixture.nativeElement as HTMLElement,
    appCalendars,
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

describe('CalendarsPage, navigation to sub-pages', () => {
  it('links to the device-calendar screen on a native platform', async () => {
    const { element } = await setup({ platform: 'android' });

    const link = element.querySelector('a[href="/settings/calendars/device"]');
    expect(link?.textContent).toContain('Gerätekalender');
  });

  it('hides the device-calendar link on web', async () => {
    const { element } = await setup({ platform: 'web' });

    expect(element.querySelector('a[href="/settings/calendars/device"]')).toBeNull();
  });

  it('always links to the ICS-subscriptions screen', async () => {
    const { element } = await setup({ platform: 'web' });

    const link = element.querySelector('a[href="/settings/calendars/ics"]');
    expect(link?.textContent).toContain('Abonnierte Kalender');
  });

  it('always links to the curated-calendars screen', async () => {
    const { element } = await setup({ platform: 'web' });

    const link = element.querySelector('a[href="/settings/calendars/curated"]');
    expect(link?.textContent).toContain('Amazone & Partnerkalender');
  });
});
