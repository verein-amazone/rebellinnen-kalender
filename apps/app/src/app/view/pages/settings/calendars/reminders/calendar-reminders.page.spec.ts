import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AppLifecycle } from '@app/cross-cutting/infrastructure/app-lifecycle';
import type { CalendarFilterOption } from '@app/interactors/calendar/calendar-filters.interactor';
import { CalendarRemindersInteractor } from '@app/interactors/notifications/calendar-reminders.interactor';
import { NotificationPreferencesInteractor } from '@app/interactors/notifications/notification-preferences.interactor';

import { CalendarRemindersPage } from './calendar-reminders.page';

class FakeCalendarReminders {
  readonly enabled = signal(true);
  readonly switches = signal<Record<string, boolean>>({});
  calendars: CalendarFilterOption[] = [
    { id: 'app-cal', name: 'Mein Kalender', color: null, emoji: null, sourceType: 'app' },
    { id: 'device-cal:google', name: 'Google', color: null, emoji: null, sourceType: 'device' },
  ];

  list(): Promise<CalendarFilterOption[]> {
    return Promise.resolve(this.calendars);
  }

  reminds(calendar: CalendarFilterOption): boolean {
    return this.switches()[calendar.id] ?? calendar.sourceType === 'app';
  }

  setReminds(calendarId: string, reminds: boolean): void {
    this.switches.update((switches) => ({ ...switches, [calendarId]: reminds }));
  }
}

class FakePreferences {
  isSupported = true;
  readonly enabled = signal(true);

  permission(): Promise<'granted'> {
    return Promise.resolve('granted');
  }
}

async function setup(
  configure: (reminders: FakeCalendarReminders, preferences: FakePreferences) => void = () =>
    undefined,
) {
  const reminders = new FakeCalendarReminders();
  const preferences = new FakePreferences();
  configure(reminders, preferences);

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: CalendarRemindersInteractor, useValue: reminders },
      { provide: NotificationPreferencesInteractor, useValue: preferences },
      { provide: AppLifecycle, useValue: { onResume: () => () => undefined } },
    ],
  });

  const fixture = TestBed.createComponent(CalendarRemindersPage);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;

  return {
    element,
    reminders,
    settle: () => fixture.whenStable(),
    switchOf: (name: string) =>
      Array.from(element.querySelectorAll('li'))
        .find((row) => row.textContent?.includes(name))!
        .querySelector<HTMLInputElement>('input[role="switch"]')!,
  };
}

describe('CalendarRemindersPage', () => {
  it('shows one switch per calendar, named after it, with where it comes from', async () => {
    const page = await setup();

    const google = page.switchOf('Google');
    expect(google.labels?.[0]?.textContent).toContain('Google');
    expect(google.labels?.[0]?.textContent).toContain('Gerätekalender');
    expect(page.switchOf('Mein Kalender').checked).toBe(true);
    expect(google.checked).toBe(false);
  });

  it('turns reminders on for a synced calendar', async () => {
    const page = await setup();

    page.switchOf('Google').click();
    await page.settle();

    expect(page.reminders.switches()).toEqual({ 'device-cal:google': true });
    expect(page.switchOf('Google').checked).toBe(true);
  });

  it('points to the notification settings while reminders are off', async () => {
    const page = await setup((reminders) => reminders.enabled.set(false));

    const link = page.element.querySelector<HTMLAnchorElement>('a[href="/settings/notifications"]');
    expect(link?.textContent).toContain('Zu den Benachrichtigungen');
  });

  it('explains that the web cannot remind, instead of offering switches', async () => {
    const page = await setup((_, preferences) => (preferences.isSupported = false));

    expect(page.element.querySelector('input[role="switch"]')).toBeNull();
    expect(page.element.textContent).toContain('nur in der App auf dem Handy');
  });
});
