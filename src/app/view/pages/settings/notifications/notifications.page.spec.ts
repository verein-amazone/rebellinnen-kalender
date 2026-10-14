import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AppLifecycle } from '@app/cross-cutting/infrastructure/app-lifecycle';
import {
  NotificationPreferencesInteractor,
  type NotificationPermission,
} from '@app/interactors/notifications/notification-preferences.interactor';

import { NotificationsPage } from './notifications.page';

class FakePreferences {
  readonly isSupported = true;
  readonly enabled = signal(false);
  readonly timedDefaults = signal<readonly number[]>([15]);
  readonly allDayDefaults = signal<readonly number[]>([900]);
  current: NotificationPermission = 'denied';
  settingsOpened = 0;

  permission(): Promise<NotificationPermission> {
    return Promise.resolve(this.current);
  }

  openSystemSettings(): Promise<void> {
    this.settingsOpened += 1;
    return Promise.resolve();
  }
}

class FakeAppLifecycle {
  private readonly handlers = new Set<() => void>();

  onResume(handler: () => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  resume(): void {
    for (const handler of this.handlers) {
      handler();
    }
  }
}

describe('NotificationsPage', () => {
  let preferences: FakePreferences;
  let lifecycle: FakeAppLifecycle;

  beforeEach(() => {
    preferences = new FakePreferences();
    lifecycle = new FakeAppLifecycle();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: NotificationPreferencesInteractor, useValue: preferences },
        { provide: AppLifecycle, useValue: lifecycle },
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(NotificationsPage);
    await settle();
    return { host: fixture.nativeElement as HTMLElement, destroy: () => fixture.destroy() };
  }

  /** Lets the permission read resolve and the view catch up with it. */
  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    await TestBed.inject(ApplicationRef).whenStable();
  }

  function settingsButton(host: HTMLElement): HTMLButtonElement | undefined {
    return [...host.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Einstellungen öffnen'),
    );
  }

  it('leads to the system settings while notifications are turned off there', async () => {
    const { host } = await render();

    settingsButton(host)?.click();

    expect(settingsButton(host)).toBeDefined();
    expect(preferences.settingsOpened).toBe(1);
  });

  it('reads the permission again when the user comes back from the system settings', async () => {
    const { host } = await render();

    preferences.current = 'granted';
    lifecycle.resume();
    await settle();

    expect(settingsButton(host)).toBeUndefined();
  });

  it('stops reading the permission once the page is gone', async () => {
    const { destroy } = await render();
    const read = vi.spyOn(preferences, 'permission');

    destroy();
    lifecycle.resume();

    expect(read).not.toHaveBeenCalled();
  });
});
