import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AppLifecycle } from '@app/cross-cutting/infrastructure/app-lifecycle';
import {
  NotificationPreferencesInteractor,
  type NotificationPermission,
} from '@app/interactors/notifications/notification-preferences.interactor';

import { NotificationsBlockedBlock } from './notifications-blocked.block';

class FakePreferences {
  readonly enabled = signal(true);
  current: NotificationPermission = 'granted';
  answer: NotificationPermission = 'granted';
  requests = 0;
  settingsOpened = 0;

  permission(): Promise<NotificationPermission> {
    return Promise.resolve(this.current);
  }

  requestPermission(): Promise<NotificationPermission> {
    this.requests += 1;
    this.current = this.answer;
    return Promise.resolve(this.answer);
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

describe('NotificationsBlockedBlock', () => {
  let preferences: FakePreferences;
  let lifecycle: FakeAppLifecycle;

  beforeEach(() => {
    preferences = new FakePreferences();
    lifecycle = new FakeAppLifecycle();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: NotificationPreferencesInteractor, useValue: preferences },
        { provide: AppLifecycle, useValue: lifecycle },
      ],
    });
  });

  async function render(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(NotificationsBlockedBlock);
    document.body.append(fixture.nativeElement as HTMLElement);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  /** Lets the permission read resolve and the view catch up with it. */
  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    await TestBed.inject(ApplicationRef).whenStable();
  }

  function button(host: HTMLElement): HTMLButtonElement | null {
    return host.querySelector('button');
  }

  it('shows nothing while reminders can arrive', async () => {
    const host = await render();

    expect(host.textContent.trim()).toBe('');
  });

  it('shows nothing while reminders are off', async () => {
    preferences.enabled.set(false);
    preferences.current = 'denied';

    const host = await render();

    expect(host.textContent.trim()).toBe('');
  });

  it('points to the system settings when the OS will not ask again', async () => {
    preferences.current = 'denied';
    const host = await render();

    expect(host.textContent).toContain('in den Systemeinstellungen ausgeschaltet');
    button(host)?.click();

    expect(preferences.settingsOpened).toBe(1);
    expect(preferences.requests).toBe(0);
  });

  it('asks again where the OS still allows it, and confirms with the focus kept', async () => {
    preferences.current = 'prompt';
    const host = await render();

    button(host)?.focus();
    button(host)?.click();
    await settle();

    expect(preferences.requests).toBe(1);
    expect(button(host)).toBeNull();
    expect(host.textContent).toContain('Mitteilungen sind wieder erlaubt');
    expect(document.activeElement).toBe(host.querySelector('p'));
  });

  it('reads the permission again when the app comes back to the foreground', async () => {
    preferences.current = 'denied';
    const host = await render();
    expect(button(host)).not.toBeNull();

    preferences.current = 'granted';
    lifecycle.resume();
    await settle();

    expect(button(host)).toBeNull();
    expect(host.textContent).toContain('Mitteilungen sind wieder erlaubt');
  });
});
