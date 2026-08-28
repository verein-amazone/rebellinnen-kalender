import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from '@app/app';
import { AppearanceInteractor } from '@app/interactors/settings/appearance.interactor';
import { CalendarMaintenanceInteractor } from '@app/interactors/calendar/calendar-maintenance.interactor';
import { DeviceCalendarSyncInteractor } from '@app/interactors/calendar/device-calendar-sync.interactor';
import { IcsSubscriptionInteractor } from '@app/interactors/calendar/ics-subscription.interactor';

class FakeDeviceCalendarSyncInteractor {
  calls = 0;

  refresh(): Promise<boolean> {
    this.calls += 1;
    return Promise.resolve(false);
  }
}

class FakeIcsSubscriptionInteractor {
  refreshAllDue(): Promise<void> {
    return Promise.resolve();
  }
}

class FakeCalendarMaintenanceInteractor {
  calls = 0;
  fail = false;

  ensureConsistency(): Promise<void> {
    this.calls += 1;
    return this.fail ? Promise.reject(new Error('rebuild failed')) : Promise.resolve();
  }
}

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-text-size');
    document.documentElement.removeAttribute('data-motion');
    document.documentElement.style.removeProperty('--rk-os-scale');

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: DeviceCalendarSyncInteractor, useClass: FakeDeviceCalendarSyncInteractor },
        { provide: IcsSubscriptionInteractor, useClass: FakeIcsSubscriptionInteractor },
        { provide: CalendarMaintenanceInteractor, useClass: FakeCalendarMaintenanceInteractor },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should host the router outlet', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('should apply the default appearance to the document root', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    expect(document.documentElement.getAttribute('data-theme')).toBe('amazone');
    // Text size and motion default to the device setting, which means no attribute at all.
    expect(document.documentElement.hasAttribute('data-text-size')).toBe(false);
    expect(document.documentElement.hasAttribute('data-motion')).toBe(false);
    // The OS scale always reaches the document; on the web it is the neutral 1.
    expect(document.documentElement.style.getPropertyValue('--rk-os-scale')).toBe('1');
  });

  it('checks the derived calendar data for consistency on start, before refreshing sources', async () => {
    const maintenance = TestBed.inject(
      CalendarMaintenanceInteractor,
    ) as unknown as FakeCalendarMaintenanceInteractor;
    const device = TestBed.inject(
      DeviceCalendarSyncInteractor,
    ) as unknown as FakeDeviceCalendarSyncInteractor;

    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    expect(maintenance.calls).toBe(1);
    expect(device.calls).toBe(1);
  });

  it('refreshes the sources anyway when the consistency check fails', async () => {
    const maintenance = TestBed.inject(
      CalendarMaintenanceInteractor,
    ) as unknown as FakeCalendarMaintenanceInteractor;
    maintenance.fail = true;
    const device = TestBed.inject(
      DeviceCalendarSyncInteractor,
    ) as unknown as FakeDeviceCalendarSyncInteractor;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    expect(device.calls).toBe(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('should reapply the appearance when the selection changes', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    TestBed.inject(AppearanceInteractor).selectTheme('nacht');
    TestBed.inject(AppearanceInteractor).selectTextSize('large');
    await fixture.whenStable();

    expect(document.documentElement.getAttribute('data-theme')).toBe('nacht');
    expect(document.documentElement.getAttribute('data-text-size')).toBe('large');
  });
});
