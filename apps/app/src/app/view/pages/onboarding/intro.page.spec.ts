import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';

import { DevicePlatformService } from '@app/cross-cutting/infrastructure/device-platform';
import { NativeEmojiPicker } from '@app/cross-cutting/infrastructure/emoji-picker';
import {
  CuratedCalendarsInteractor,
  type CuratedCalendarRow,
} from '@app/interactors/calendar/curated-calendars.interactor';
import { NotificationPreferencesInteractor } from '@app/interactors/notifications/notification-preferences.interactor';

import { IntroPage } from './intro.page';

function row(overrides: Partial<CuratedCalendarRow>): CuratedCalendarRow {
  return {
    id: 'source-1',
    name: 'Rebell*innen Termine',
    description: 'Aktionstage und Veranstaltungen vom Verein Amazone.',
    color: '#7B3FA8',
    emoji: '✊',
    enabled: true,
    state: 'ok',
    lastError: null,
    ...overrides,
  };
}

class FakeCuratedCalendarsInteractor {
  rows: CuratedCalendarRow[] = [
    row({}),
    row({ id: 'source-2', name: 'Feiertage Österreich', description: 'Gesetzliche Feiertage.' }),
  ];
  listCalls = 0;
  readonly setEnabledCalls: { id: string; enabled: boolean }[] = [];

  listForIntroduction(): Promise<CuratedCalendarRow[]> {
    this.listCalls++;
    return Promise.resolve(this.rows);
  }

  setEnabled(id: string, enabled: boolean): Promise<void> {
    this.setEnabledCalls.push({ id, enabled });
    this.rows = this.rows.map((entry) => (entry.id === id ? { ...entry, enabled } : entry));
    return Promise.resolve();
  }
}

async function setup(options: { platform: 'ios' | 'web'; step: string }) {
  const curated = new FakeCuratedCalendarsInteractor();

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: DevicePlatformService, useValue: { platform: options.platform } },
      { provide: CuratedCalendarsInteractor, useValue: curated },
      // The name field's profile store would otherwise reach the real plugin.
      { provide: NativeEmojiPicker, useValue: { pickEmoji: () => Promise.resolve(null) } },
      {
        provide: NotificationPreferencesInteractor,
        useValue: {
          isSupported: options.platform !== 'web',
          enabled: signal(false),
          timedDefaults: signal([]),
          allDayDefaults: signal([]),
        },
      },
    ],
  });

  const fixture = TestBed.createComponent(IntroPage);
  fixture.componentRef.setInput('step', options.step);
  await fixture.whenStable();

  return { fixture, element: fixture.nativeElement as HTMLElement, curated };
}

describe('IntroPage', () => {
  it('lists every curated calendar on the calendars step, all switched on', async () => {
    const { element } = await setup({ platform: 'ios', step: '4' });

    expect(element.querySelector('h1')?.textContent).toContain('Welche Kalender willst du sehen?');
    expect(element.textContent).toContain('Schritt 4 von 6');
    const switches = [...element.querySelectorAll<HTMLInputElement>('input[role="switch"]')];
    expect(switches.map((input) => input.labels?.[0]?.textContent?.trim())).toEqual([
      expect.stringContaining('Rebell*innen Termine'),
      expect.stringContaining('Feiertage Österreich'),
    ]);
    expect(switches.every((input) => input.checked)).toBe(true);
  });

  it('switches a calendar off from its toggle', async () => {
    const { fixture, element, curated } = await setup({ platform: 'ios', step: '4' });

    element.querySelector<HTMLInputElement>('#intro-calendar-source-2')!.click();
    await fixture.whenStable();

    expect(curated.setEnabledCalls).toEqual([{ id: 'source-2', enabled: false }]);
    expect(element.querySelector<HTMLInputElement>('#intro-calendar-source-2')!.checked).toBe(
      false,
    );
  });

  it('does not load the calendars on any other step', async () => {
    const { curated } = await setup({ platform: 'ios', step: '3' });

    expect(curated.listCalls).toBe(0);
  });

  it('skips the calendars step in the browser, which cannot download a calendar', async () => {
    const { element } = await setup({ platform: 'web', step: '4' });

    expect(element.querySelector('h1')?.textContent).toContain('Deine Daten bleiben bei dir');
    expect(element.textContent).toContain('Schritt 4 von 4');
  });
});
